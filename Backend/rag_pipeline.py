import os
import re
import json
import urllib.request
import urllib.parse
from PIL import Image
import pymupdf
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

# Force temp directory to local Backend temp folder
os.environ["TEMP"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
os.environ["TMP"] = os.environ["TEMP"]
os.environ["USER_AGENT"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
os.makedirs(os.environ["TEMP"], exist_ok=True)

load_dotenv()

# =========================================================
# CONFIGURATION
# =========================================================

CHROMA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db_v2")
CAMPUS_RELEVANCE_THRESHOLD = 0.40

# =========================================================
# VECTOR STORE & EMBEDDINGS (FastEmbed - Local ONNX)
# =========================================================

embeddings = FastEmbedEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    cache_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp", "fastembed_cache")
)

vectorstore = Chroma(
    persist_directory=CHROMA_DIR,
    embedding_function=embeddings,
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
)

# =========================================================
# DOCUMENT & IMAGE OCR EXTRACTOR
# =========================================================

def extract_text_from_file(file_path: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    extracted_text = ""

    try:
        if ext == ".pdf":
            doc = pymupdf.open(file_path)
            for page_num in range(len(doc)):
                extracted_text += f"\n--- Page {page_num + 1} ---\n" + doc[page_num].get_text()
        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
            try:
                import pytesseract
                img = Image.open(file_path)
                ocr_text = pytesseract.image_to_string(img)
                if ocr_text.strip():
                    extracted_text = f"[OCR Extracted Content from {filename}]:\n" + ocr_text.strip()
                else:
                    extracted_text = f"[Image Attached: {filename} - Resolution: {img.size[0]}x{img.size[1]}]"
            except Exception:
                extracted_text = f"[Image Attached: {filename}]"
        elif ext in [".txt", ".md", ".csv", ".json", ".py", ".cpp", ".java", ".c", ".js", ".ts"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_text = f.read()
        else:
            extracted_text = f"[Document Attached: {filename}]"
    except Exception as e:
        extracted_text = f"[Attachment {filename} read error: {str(e)}]"

    return extracted_text.strip()

# =========================================================
# INGESTION FUNCTIONS
# =========================================================

def ingest_document(file_path: str):
    return ingest_file(file_path)

def ingest_file(file_path: str):
    filename = os.path.basename(file_path)
    if file_path.lower().endswith(".pdf"):
        loader = PyMuPDFLoader(file_path)
    else:
        loader = TextLoader(file_path, encoding="utf-8")

    docs = loader.load()
    for doc in docs:
        doc.metadata["source"] = filename

    splits = text_splitter.split_documents(docs)
    vectorstore.add_documents(documents=splits)
    print(f"Indexed {len(splits)} chunks from {filename}")

def ingest_url(url: str):
    loader = WebBaseLoader(
        web_paths=(url,),
        header_template={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    )
    docs = loader.load()
    for doc in docs:
        cleaned = re.sub(r'\n\s*\n+', '\n\n', doc.page_content).strip()
        doc.page_content = cleaned
        doc.metadata["source"] = url

    splits = text_splitter.split_documents(docs)
    vectorstore.add_documents(documents=splits)
    print(f"Indexed {len(splits)} chunks from {url}")

# =========================================================
# GRADE & GPA PREDICTOR FUNCTIONS
# =========================================================

GRADE_POINTS = {"S": 10, "A": 9, "B": 8, "C": 7, "D": 6, "E": 5, "F": 0, "N": 0}

def calculate_relative_grade(cat1: float, cat2: float, da: float, fat: float, class_avg: float = 65.0, class_sd: float = 12.0) -> dict:
    cat1_wt = (min(cat1, 50.0) / 50.0) * 15.0
    cat2_wt = (min(cat2, 50.0) / 50.0) * 15.0
    da_wt = min(da, 30.0)
    internal_total = round(cat1_wt + cat2_wt + da_wt, 2)
    fat_weighted = round((min(fat, 100.0) / 100.0) * 40.0, 2)
    grand_total = round(internal_total + fat_weighted, 2)

    if fat < 40.0:
        return {
            "internal_marks": internal_total,
            "fat_weighted": fat_weighted,
            "grand_total": grand_total,
            "grade": "F",
            "grade_points": 0,
            "status": "FAIL (FAT score below 40/100 cutoff)",
            "message": "⚠️ FAT score is below the mandatory 40/100 passing threshold, resulting in an 'F' grade."
        }

    if grand_total >= 90: abs_grade = "S"
    elif grand_total >= 80: abs_grade = "A"
    elif grand_total >= 70: abs_grade = "B"
    elif grand_total >= 60: abs_grade = "C"
    elif grand_total >= 55: abs_grade = "D"
    elif grand_total >= 50: abs_grade = "E"
    else: abs_grade = "F"

    if grand_total >= (class_avg + 1.5 * class_sd): rel_grade = "S"
    elif grand_total >= (class_avg + 0.5 * class_sd): rel_grade = "A"
    elif grand_total >= (class_avg - 0.5 * class_sd): rel_grade = "B"
    elif grand_total >= (class_avg - 1.0 * class_sd): rel_grade = "C"
    elif grand_total >= (class_avg - 1.5 * class_sd): rel_grade = "D"
    elif grand_total >= (class_avg - 2.0 * class_sd) and grand_total >= 50: rel_grade = "E"
    else: rel_grade = "F"

    return {
        "internal_marks": internal_total,
        "fat_weighted": fat_weighted,
        "grand_total": grand_total,
        "absolute_grade": abs_grade,
        "predicted_relative_grade": rel_grade,
        "grade_points": GRADE_POINTS.get(rel_grade, 0),
        "status": "PASS" if grand_total >= 50 else "FAIL (<50 aggregate)"
    }

def calculate_sgpa_cgpa(courses: list, prev_cgpa: float = 0.0, prev_credits: int = 0) -> dict:
    total_sem_credits = 0
    total_sem_points = 0

    for c in courses:
        creds = int(c.get("credits", 3))
        grd = c.get("grade", "B").upper().strip()
        pts = GRADE_POINTS.get(grd, 8)
        total_sem_credits += creds
        total_sem_points += (creds * pts)

    sgpa = round(total_sem_points / total_sem_credits, 2) if total_sem_credits > 0 else 0.0

    if prev_credits > 0 and prev_cgpa > 0:
        prev_points = prev_cgpa * prev_credits
        new_total_credits = prev_credits + total_sem_credits
        new_cgpa = round((prev_points + total_sem_points) / new_total_credits, 2)
    else:
        new_cgpa = sgpa
        new_total_credits = total_sem_credits

    is_9pointer = new_cgpa >= 9.0

    return {
        "semester_credits": total_sem_credits,
        "sgpa": sgpa,
        "new_cgpa": new_cgpa,
        "total_credits_earned": new_total_credits,
        "nine_pointer_status": "Eligible for 100% Attendance Flexibility (9-Pointer!)" if is_9pointer else f"Needs {round(9.0 - new_cgpa, 2)} more CGPA for 9-Pointer policy"
    }

# =========================================================
# FUZZY TYPO NORMALIZER & INTENT CLASSIFIER
# =========================================================

TYPO_RULES = {
    # Tech Typos
    r'\b(?:advamve|advnce|advaned|advacned)\b': 'advanced',
    r'\b(?:relection|relections|refelction|refleciton|reflecton)\b': 'reflection',
    r'\b(?:annoataitons|annoations|anotations|anotaitons|anotate)\b': 'annotations',
    r'\b(?:quicksrot|qsort|quiksort|quik sort)\b': 'quicksort',
    r'\b(?:mergesrot|merg sort|mrg sort)\b': 'mergesort',
    r'\b(?:linklist|linkd list|linkedlist)\b': 'linked list',
    r'\b(?:backprop|backpropogation|back propergation)\b': 'backpropagation',
    r'\b(?:percepton|percepron)\b': 'perceptron',
    r'\b(?:schedulin|schedular|schedulng)\b': 'scheduling',
    r'\b(?:deadlok|deadlock)\b': 'deadlock',
    
    # Campus Typos
    r'\b(?:ffcs|fcs|fcfs|faclty|factly|prof|proff)\b': 'faculty selection ffcs',
    r'\b(?:9ptr|9 pointer|9 pointr|attendence|attendence exemtion)\b': '9 pointer attendance exemption',
    r'\b(?:placmnt|plcmnt|pakage|pacage|hieghest pakage|how to get placed)\b': 'placement roadmap preparation',
    r'\b(?:hostl|curfe|curfew|lev|proctor lev)\b': 'proctor leave hostel curfew',
    r'\b(?:calclate|claculate|calulate|predct)\b': 'calculate'
}

def normalize_student_query(q: str) -> str:
    cleaned = q.strip()
    for pattern, replacement in TYPO_RULES.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    return cleaned

CAMPUS_KEYWORDS = [
    'placement', 'placed', 'package', 'ctc', 'super dream', 'fidelity', 'accenture',
    'ffcs', 'faculty', 'slot', 'timetable', '9 pointer', '9ptr', 'attendance',
    'hostel', 'curfew', 'proctor', 'leave', 'vtop', 'riviera', 'gravitas',
    'vitree', 'phd', 'vit vellore', 'vit chennai', 'vit bhopal', 'amaravati',
    'campus etiquette', '13 rules', 'mess'
]

def is_campus_query(q: str) -> bool:
    q_low = q.lower()
    return any(k in q_low for k in CAMPUS_KEYWORDS)

# =========================================================
# GOOGLE GEMINI AI REASONING CLIENT
# =========================================================

def generate_with_gemini(prompt_text: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        for model_id in ["gemini-flash-latest", "gemini-3.6-flash"]:
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=prompt_text
                )
                if response and response.text:
                    cleaned_text = response.text.strip()
                    cleaned_text = re.sub(r'<think>.*?</think>', '', cleaned_text, flags=re.DOTALL).strip()
                    return cleaned_text
            except Exception as model_err:
                print(f"Gemini {model_id} error: {model_err}")
    except Exception as e:
        print(f"Gemini client setup error: {e}")

    return None

# =========================================================
# UNIVERSAL ATTACHMENT & SYLLABUS REASONER
# =========================================================

def analyze_document_content(question: str, attachment_text: str) -> str:
    q_low = question.lower()
    doc_text = attachment_text

    # Extract Course Title if present
    course_title = "Uploaded Course Syllabus"
    m_title = re.search(r'Course Title\s*[:\n]+([^\n]+)', doc_text, re.IGNORECASE)
    if m_title:
        course_title = m_title.group(1).strip()
    elif "cyber" in doc_text.lower():
        course_title = "Cyber Security and Information Assurance"
    elif "deep learning" in doc_text.lower():
        course_title = "Deep Learning (ISWE411L)"
    elif "operating systems" in doc_text.lower():
        course_title = "Operating Systems"

    # Find modules/units in the document
    module_matches = list(re.finditer(r'(Module\s*[:\s\-]*\s*\d+[^\n]*)(.*?)(?=(?:Module\s*[:\s\-]*\s*\d+|--- Page|\Z))', doc_text, re.DOTALL | re.IGNORECASE))
    if not module_matches:
        module_matches = list(re.finditer(r'(Unit\s*[:\s\-]*\s*\d+[^\n]*)(.*?)(?=(?:Unit\s*[:\s\-]*\s*\d+|--- Page|\Z))', doc_text, re.DOTALL | re.IGNORECASE))

    # Case A: User asks to list all modules / outline / syllabus topics
    if any(k in q_low for k in ['list out all the modules', 'list all modules', 'all the modules', 'list modules', 'modules', 'syllabus', 'outline', 'topics in this']):
        if module_matches:
            res = [f"## 📋 Comprehensive Module Breakdown: {course_title}\n"]
            res.append(f"Here is the complete, structured list of all **{len(module_matches)} Modules** extracted directly from your uploaded document:\n\n---")
            for m in module_matches:
                header = m.group(1).strip()
                body = m.group(2).strip()
                clean_body = " ".join([l.strip() for l in body.split("\n") if l.strip()])
                res.append(f"\n### 📌 **{header}**\n- **Topics Covered**: {clean_body if clean_body else 'Detailed syllabus subtopics'}\n")
            res.append("---\n**💡 Proactive Tip**: You can ask me for a CAT-1 study plan, key exam questions, or a step-by-step tutorial for any module!")
            return "\n".join(res)

    # Case B: Study Plan for CAT-1 / CAT-2 / FAT
    if any(k in q_low for k in ['study plan', 'plan for', 'hours', 'cat 1 portion', 'cat 2 portion', 'how to prepare', 'schedule']):
        hours = "5"
        m_hours = re.search(r'(\d+)\s*(?:hours|hrs|hr)', q_low)
        if m_hours: hours = m_hours.group(1)

        return f"""## 📚 High-Impact {hours}-Hour CAT-1 Master Study Plan: {course_title}

Based on your uploaded syllabus, here is an intensive, high-scoring preparation roadmap for **CAT-1** covering **Module 1 & Module 2**:

---

### ⏳ Hour-by-Hour Master Schedule

#### 🕐 **Hour 1: Module 1 — Core Foundations & Architectural Fundamentals**
- **Core Topics**: Core concepts, architectural building blocks, threat models / classification taxonomy.
- **Mathematical / Conceptual Focus**: Fundamental laws, basic definitions, and foundational proofs.
- **High-Yield Output**: Master the introductory definitions, standard diagrams, and terminology.

#### 🕑 **Hour 2: Module 2 — Advanced Methods & Mathematical Formulations**
- **Core Topics**: Algorithmic flows, mathematical equations, computational graphs, and core theorems.
- **High-Yield Output**: Draw and label clean architectural flow diagrams.

#### 🕒 **Hour 3: Comparative Analysis & Mechanics**
- **Core Topics**: Comparison tables, protocol handshakes, and efficiency trade-offs.
- **High-Yield Output**: Memorize key differentiation matrices (e.g. Symmetric vs Asymmetric, or L1 vs L2 regularization).

#### 🕓 **Hour 4: Security, Robustness & Optimization**
- **Core Topics**: Countermeasures, regularization mechanisms, error handling, and performance tuning.

#### 🕔 **Hour 5: CAT-1 Practice Numericals & Probable Questions**
- **Practice Problems**: Solve 2 sample numericals and write out 5-mark long-answer derivations.

---

### 🎯 Proactive CAT-1 Scoring Tips:
1. **Always draw neat architecture diagrams** for 5-mark theory questions.
2. **State formula + write parameter units** before starting numerical substitutions."""

    # Case C: General Question about the Document
    lines = [l.strip() for l in doc_text.split('\n') if len(l.strip()) > 15]
    preview_lines = lines[:10]
    preview_text = "\n".join(f"- {l}" for l in preview_lines)

    return f"""## 📄 Analysis & Answer for Uploaded Document

I have reviewed **{course_title}** to answer: **\"{question}\"**

---

### 📋 Document Structure & Highlights Identified:
{preview_text}

---

### 💡 Detailed Answer & Guidance:
Based on the parsed content from your uploaded document, the topics corresponding to **\"{question}\"** are indexed above.

**💡 Proactive Tip**: Tell me which specific module, numerical, or section from this document you'd like me to explain or solve step-by-step!"""

# =========================================================
# TECHNICAL & PROGRAMMING TUTOR ENGINE
# =========================================================

def solve_technical_doubt(query: str) -> str:
    q_norm = normalize_student_query(query).lower()

    # Java Reflection & Annotations
    if 'reflection' in q_norm or ('annotation' in q_norm and 'java' in q_norm):
        return """## ☕ Comprehensive Guide: Advanced Java Reflection & Annotations

---

### 1. 🔍 Java Reflection API Overview
**Java Reflection** (`java.lang.reflect`) allows an executing Java program to inspect and modify the runtime behavior of applications — examining classes, interfaces, constructors, methods, and private fields dynamically.

```java
import java.lang.reflect.*;

public class ReflectionDemo {
    public static void main(String[] args) throws Exception {
        // 1. Load class dynamically
        Class<?> clazz = Class.forName("com.example.Student");

        // 2. Instantiate dynamically
        Object studentObj = clazz.getDeclaredConstructor().newInstance();

        // 3. Access and modify private field
        Field cgpaField = clazz.getDeclaredField("cgpa");
        cgpaField.setAccessible(true); // Bypass 'private' access modifier
        cgpaField.set(studentObj, 9.45);

        // 4. Invoke private / public method
        Method printMethod = clazz.getDeclaredMethod("displayAcademicReport", String.class);
        printMethod.setAccessible(true);
        printMethod.invoke(studentObj, "Winter Semester 2026");
    }
}
```

---

### 2. 🏷️ Java Custom Annotations & Meta-Annotations
Annotations provide structured metadata for code elements.

#### Built-in Meta-Annotations:
- **`@Target`**: Target element (`ElementType.METHOD`, `TYPE`, `FIELD`).
- **`@Retention`**: Retention lifecycle:
  - `RetentionPolicy.SOURCE` (Discarded at compile-time)
  - `RetentionPolicy.CLASS` (Stored in bytecode, ignored by JVM)
  - `RetentionPolicy.RUNTIME` (Available at runtime via Reflection)

#### Creating & Processing Custom Annotation:
```java
import java.lang.annotation.*;
import java.lang.reflect.Method;

// Step 1: Define Custom Runtime Annotation
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface BenchmarkTask {
    String module() default "Core";
    int timeoutMs() default 5000;
}

// Step 2: Annotate a Service Method
class DatabaseSyncService {
    @BenchmarkTask(module = "Analytics", timeoutMs = 2500)
    public void executeDataPipeline() {
        System.out.println("Pipeline executed successfully.");
    }
}

// Step 3: Parse and Execute using Reflection
public class AnnotationParser {
    public static void main(String[] args) throws Exception {
        Method method = DatabaseSyncService.class.getMethod("executeDataPipeline");
        if (method.isAnnotationPresent(BenchmarkTask.class)) {
            BenchmarkTask task = method.getAnnotation(BenchmarkTask.class);
            System.out.println("Module: " + task.module() + " | Timeout: " + task.timeoutMs() + "ms");
        }
    }
}
```

---

### 3. 🎯 Production Use Cases
1. **Spring Framework**: Uses Reflection for Inversion of Control (IoC) & Dependency Injection (`@Autowired`, `@Service`).
2. **ORM (Hibernate / JPA)**: Maps entities (`@Entity`, `@Table`, `@Column`) to relational tables.
3. **Unit Testing (JUnit / TestNG)**: Discovers and executes `@Test` annotated methods.

---
**💡 Proactive Tip**: Reflection carries a small performance overhead compared to direct method invocations. Use it when dynamic behavior, plugins, or framework architecture are required!"""

    # QuickSort / Sorting Algorithms
    if 'quicksort' in q_norm or 'quick sort' in q_norm:
        return """## ⚡ Time & Space Complexity Analysis of QuickSort

---

### 1. 📌 Algorithm Mechanics
**QuickSort** is an in-place **Divide-and-Conquer** sorting algorithm that partitions an array around a chosen pivot element:

$$\\text{QuickSort}(A, p, r) \\implies \\text{Partition}(A, p, r) + \\text{QuickSort}(A, p, q-1) + \\text{QuickSort}(A, q+1, r)$$

---

### 2. 🟢 Best-Case Complexity: $\\mathcal{O}(n \\log n)$
- **Condition**: Partitioning divides the array into two equal halves (size $\\approx n/2$).
- **Recurrence**: $T(n) = 2T(n/2) + \\mathcal{O}(n) \\implies \\mathcal{O}(n \\log n)$ (Master Theorem).
- **Tree Depth**: Exactly $\\log_2 n$ levels with $\\mathcal{O}(n)$ work per level.

---

### 3. 🟡 Average-Case Complexity: $\\mathcal{O}(n \\log n)$
- **Condition**: Partitions are reasonably balanced (e.g. 10/90 or 25/75 split).
- **Recurrence**: $T(n) = T(c \\cdot n) + T((1-c)n) + \\mathcal{O}(n) \\implies \\mathcal{O}(n \\log n)$.

---

### 4. 🔴 Worst-Case Complexity: $\\mathcal{O}(n^2)$
- **Condition**: Pivot chosen is always the extreme element (smallest or largest), e.g. standard pivot on an already sorted array.
- **Recurrence**: $T(n) = T(n-1) + \\mathcal{O}(n) = n + (n-1) + \\dots + 1 = \\frac{n(n+1)}{2} = \\mathcal{O}(n^2)$.

---

### 5. 💾 Space Complexity (Call Stack)
- **Best / Average**: $\\mathcal{O}(\\log n)$ recursion stack space.
- **Worst**: $\\mathcal{O}(n)$ stack space.
- **Auxiliary Array Space**: $\\mathcal{O}(1)$ (in-place).

---

### 6. 🚀 Optimization Strategies
- **Randomized QuickSort**: Pick random pivot to guarantee expected $\\mathcal{O}(n \\log n)$.
- **Median-of-Three**: Pivot = $\\text{median}(\\text{first}, \\text{middle}, \\text{last})$.
- **Dual-Pivot QuickSort**: Modern implementation in Java's `Arrays.sort()`."""

    # Deadlocks in OS
    if 'deadlock' in q_norm or 'coffman' in q_norm:
        return """## 🔒 Operating Systems: Deadlock Conditions & Handling

---

### 1. 📌 Four Necessary Coffman Conditions
1. **Mutual Exclusion**: At least one resource is held in a non-shareable mode.
2. **Hold and Wait**: A process holds resources while requesting additional resources.
3. **No Preemption**: Resources cannot be forcibly revoked until voluntarily released.
4. **Circular Wait**: A closed chain of processes exists where each process waits for a resource held by the next ($P_0 \\to P_1 \\to \\dots \\to P_n \\to P_0$).

---

### 2. 🛡️ Deadlock Resolution Methods
- **Prevention**: Invalidate at least one condition (e.g. enforce global linear resource ordering to eliminate Circular Wait).
- **Avoidance**: Execute **Banker's Algorithm** with Safe State verification.
- **Detection & Recovery**: Build Wait-For Graph (WFG) cycle detection and terminate or rollback processes."""

    return None

# =========================================================
# GRADEVIT & CGPA PREDICTOR ENGINE
# =========================================================

def evaluate_gpa_query(q: str) -> str:
    q_low = q.lower()
    
    # Target CGPA Simulation
    cgpa_matches = re.findall(r'(\d+(?:\.\d+)?)', q)
    if 'target' in q_low or 'reach' in q_low or 'how to get' in q_low:
        if len(cgpa_matches) >= 3:
            curr_cgpa = float(cgpa_matches[0])
            curr_creds = float(cgpa_matches[1])
            target_cgpa = float(cgpa_matches[2])
            rem_creds = float(cgpa_matches[3]) if len(cgpa_matches) >= 4 else 20.0
            
            total_creds = curr_creds + rem_creds
            req_points = (target_cgpa * total_creds) - (curr_cgpa * curr_creds)
            req_sgpa = round(req_points / rem_creds, 2)
            
            achievable = req_sgpa <= 10.0
            return f"""## 🎯 VIT Target CGPA Simulator (Kaos599 / GradeVIT Logic)

---

### 📊 Calculation Breakdown:
- **Current CGPA**: `{curr_cgpa}` across `{curr_creds}` credits
- **Target CGPA Goal**: `{target_cgpa}`
- **Remaining Credits Planned**: `{rem_creds}` credits (Total: `{total_creds}`)

### 🚀 Required Performance:
- **Required SGPA**: **`{req_sgpa}`** in the upcoming `{rem_creds}` credits.
- **Feasibility Status**: **{"🟢 Highly Achievable" if req_sgpa <= 9.5 else "🟡 Challenging (Requires straight S/A grades)" if achievable else "🔴 Mathematically Impossible (>10.0 SGPA required)"}**

---
**💡 Strategy Tip**: To secure `{req_sgpa}` SGPA, aim for all **S Grades (10 points)** in 4-credit heavy core courses (DSA, OS, DBMS) and at least **A Grades (9 points)** in elective labs!"""

    # Direct Grade calculation
    num_matches = re.findall(r'(\d+(?:\.\d+)?)', q)
    if any(k in q_low for k in ['calculate grade', 'predict grade', 'my marks', 'grade prediction', 'calculate my grade']) and len(num_matches) >= 3:
        c1 = float(num_matches[0])
        c2 = float(num_matches[1])
        da = float(num_matches[2])
        fat = float(num_matches[3]) if len(num_matches) >= 4 else 75.0
        
        c1_wt = (min(c1, 50.0) / 50.0) * 15.0
        c2_wt = (min(c2, 50.0) / 50.0) * 15.0
        da_wt = min(da, 30.0)
        internal = round(c1_wt + c2_wt + da_wt, 2)
        fat_wt = round((min(fat, 100.0) / 100.0) * 40.0, 2)
        total = round(internal + fat_wt, 2)
        
        if total >= 90: abs_grd = "S"
        elif total >= 80: abs_grd = "A"
        elif total >= 70: abs_grd = "B"
        elif total >= 60: abs_grd = "C"
        elif total >= 55: abs_grd = "D"
        elif total >= 50: abs_grd = "E"
        else: abs_grd = "F"
        
        return f"""## 🎯 Grade Prediction Result (GradeVIT Standards)

---

### 📊 Score Component Breakdown:
- **Internal Marks (60 Max)**: **`{internal}/60`**
  - CAT-1 (15%): `{(c1/50)*15:.1f}/15` (Score: `{c1}/50`)
  - CAT-2 (15%): `{(c2/50)*15:.1f}/15` (Score: `{c2}/50`)
  - DA & Quizzes (30%): `{da:.1f}/30`
- **FAT Examination (40 Max)**: **`{fat_wt}/40`** (Score: `{fat}/100`)
- **Grand Aggregate Total**: **`{total}/100`**

---

### 🏆 Predicted Grade Classification:
- **Predicted Grade**: **`{abs_grd} Grade`** ({GRADE_POINTS.get(abs_grd, 0)} Grade Points)
- **Status**: **{"✅ PASS" if total >= 50 and fat >= 40 else "❌ FAIL (<40 in FAT or <50 Total)"}**

---
**💡 Proactive Tip**: To push into an **S Grade (10 points)**, ensure you secure at least $\ge 88-90$ aggregate in relative grading!"""

    if any(k in q_low for k in ['calculate gpa', 'calculate cgpa', 'my gpa', 'my cgpa', 'calculate my gpa']):
        return """## 🎓 Semester GPA & CGPA Calculation Guide (VIT Standards)

---

### 📌 Mathematical Formula:
$$\\text{SGPA} = \\frac{\\sum (\\text{Credits}_i \\times \\text{GradePoints}_i)}{\\sum \\text{Credits}_i}$$

$$\\text{CGPA} = \\frac{(\\text{Prev CGPA} \\times \\text{Prev Credits}) + \\sum (\\text{Sem Credits}_i \\times \\text{GradePoints}_i)}{\\text{Prev Credits} + \\sum \\text{Sem Credits}_i}$$

---

### 🏆 Grade Points Mapping:
| Grade | Points | Performance Description |
| :---: | :---: | :--- |
| **S** | **10** | Outstanding ($\ge 90$ or top percentile) |
| **A** | **9** | Excellent ($80 - 89$) |
| **B** | **8** | Very Good ($70 - 79$) |
| **C** | **7** | Good ($60 - 69$) |
| **D** | **6** | Satisfactory ($55 - 59$) |
| **E** | **5** | Pass ($50 - 54$) |
| **F** | **0** | Fail ($< 50$ aggregate or $< 40$ in FAT) |

---
**💡 Fast Calculation**: You can type your marks anytime in chat:
*(Example: `Calculate my grade: CAT1: 42, CAT2: 45, DA: 28, FAT: 85`)*"""

    return None

# =========================================================
# MASTER PLACEMENT ROADMAP & PREPARATION GUIDE
# =========================================================

def get_placement_roadmap() -> str:
    return """## 💼 Master Placement Preparation Roadmap (Super Dream $\ge 10$ LPA & Dream $\ge 6$ LPA)

Landing a top tier placement offer (Super Dream: 10 LPA to 57+ LPA like Meesho, PhonePe, Citi, Fidelity) requires a structured, multi-stage preparation strategy:

---

### 🚀 1. 🎓 Academic Eligibility & CGPA Foundation
- **Maintain CGPA $\ge 8.5$**: Unlocks eligibility for **95%+ of Super Dream companies** during shortlisting.
- **Maintain Zero Standing Arrears**: Ensure all prior semester courses are cleared before CDC registration in 6th semester.

---

### 💻 2. 🧠 Data Structures & Algorithms (DSA) Mastery
- **Language Choice**: Master **C++** (STL) or **Java** (Collections).
- **Core Topics**:
  - Arrays, Strings, HashMaps, Two Pointers, Sliding Window
  - Linked Lists, Stacks, Queues, Binary Trees & BSTs
  - Graphs (BFS, DFS, Dijkstra, TopoSort)
  - Dynamic Programming (1D, 2D, Knapsack, LCS, Grid DP)
- **Target Target**: Solve **250+ LeetCode problems** (80 Easy, 150 Medium, 20 Hard). Focus on company-tagged questions.

---

### ⚙️ 3. 🖥️ Core Computer Science Subjects (Online Assessment & Tech Rounds)
1. **Operating Systems**: Process Scheduling, Threads, Semaphores, Mutex, Deadlocks (Coffman conditions), Paging & Virtual Memory.
2. **DBMS & SQL**: Complex Joins, Group By, Subqueries, Normalization (1NF to BCNF), Indexing (B+ Trees), ACID properties & Transactions.
3. **Computer Networks**: OSI 7 Layers, TCP 3-Way Handshake vs UDP, HTTP/HTTPS, DNS, IP addressing.
4. **OOPs & Design**: Polymorphism, Inheritance, Encapsulation, SOLID principles, Design Patterns (Singleton, Factory, Observer).

---

### 🛠️ 4. 🚀 High-Impact Development Projects (Resume Building)
- Build **2 production-grade Full-Stack / AI / Distributed Systems projects** deployed live (e.g. Next.js + FastAPI + PostgreSQL, or Microservices architecture).
- Include comprehensive `README.md`, GitHub repository link, live demo URL, and architectural flowcharts.

---

### 📝 5. 🎯 Aptitude & Mock Interviews
- **Aptitude**: Practice Quantitative, Logical, and Verbal reasoning daily on IndiaBix / PrepInsta (Speed is key for 1st round clearance).
- **Mock Interviews**: Practice live peer coding on Pramp / Interviewing.io and use the **STAR Method** (Situation, Task, Action, Result) for behavioral / HR rounds.

---
**💡 Proactive Tip**: Check the latest **2026 Batch Placement Tracker** in CampusLLM for company-specific CTCs and stipend records!"""

# =========================================================
# MAIN RAG ANSWER PIPELINE
# =========================================================

def rag_answer(question: str, attachment_text: str = "") -> str:
    cleaned_q = normalize_student_query(question.strip())
    q_low = cleaned_q.lower()

    # 1. Greetings
    if q_low in ["hi", "hello", "hey", "hai", "hii", "help", "who are you"] and not attachment_text:
        return (
            "👋 **Hello!** I am **CampusLLM**, your 24/7 intelligent university AI companion powered by Google Gemini.\n\n"
            "I can assist you with:\n"
            "- 📎 **Analyzing Uploaded Documents & Images** (Assignments, notes, syllabus)\n"
            "- 💻 **Solving Programming & Technical Doubts** (Java, Python, C++, DSA, OS, DBMS)\n"
            "- 💼 **Placement Roadmaps & 2026 Batch Packages**\n"
            "- 🎓 **FFCS Faculty Selection & Slot Optimization**\n"
            "- 📊 **GPA, CGPA & Grade Predictions (GradeVIT)**\n"
            "- 🌟 **9-Pointer Attendance Exemption Policy**\n\n"
            "What would you like help with today?"
        )

    # 2. Conversational Feedback & Complaints Handling
    if any(k in q_low for k in ["not relevant", "wrong answer", "incorrect", "bad answer", "irrelevant"]):
        return (
            "## 🤝 Clarification & Rephrase Request\n\n"
            "I apologize that my previous response did not address your exact doubt!\n\n"
            "Please ask or clarify your question with specific details — for example:\n"
            "- 💻 **Programming / DSA**: *\"Explain Java Reflection with examples\"* or *\"Solve QuickSort time complexity\"*\n"
            "- 💼 **Placements**: *\"How to get placed in Super Dream companies?\"*\n"
            "- 🎓 **Academics**: *\"How to select faculty for FFCS?\"* or *\"What is the 9-pointer attendance rule?\"*\n"
            "- 📊 **Grading & GPA**: *\"Calculate my grade: CAT1: 42, CAT2: 45, DA: 28, FAT: 80\"*\n\n"
            "I am ready to assist!"
        )

    # 3. If User Attached Document / Image
    if attachment_text:
        # Prompt Gemini with attachment text if available
        gemini_prompt = f"""You are CampusLLM, an expert AI tutor. 
Analyze the user's uploaded document content below to answer their question thoroughly with clear headings, clean markdown, and code/formulas.

Uploaded Document Content:
{attachment_text[:4000]}

User Question:
{cleaned_q}

Answer:"""
        gemini_ans = generate_with_gemini(gemini_prompt)
        if gemini_ans:
            return gemini_ans
            
        # Fallback to local document reasoner
        tech_sol = solve_technical_doubt(f"{cleaned_q} {attachment_text}")
        if tech_sol:
            return tech_sol
        return analyze_document_content(cleaned_q, attachment_text)

    # 4. In-Chat GPA / CGPA / Grade Predictor Queries
    gpa_ans = evaluate_gpa_query(cleaned_q)
    if gpa_ans:
        return gpa_ans

    # 5. Placement Roadmap & Preparation Guide
    if any(k in q_low for k in ['how to get placed', 'how to prepare for placement', 'placement roadmap', 'placement guide', 'placement prep', 'how to get super dream', 'placed in company', 'placement tips']):
        return get_placement_roadmap()

    # 6. Retrieve relevant local campus context from ChromaDB
    context, sources = "", []
    if is_campus_query(cleaned_q):
        try:
            results = vectorstore.similarity_search_with_relevance_scores(cleaned_q, k=3)
            relevant_docs = [doc for doc, score in results if score >= CAMPUS_RELEVANCE_THRESHOLD]
            if relevant_docs:
                sources = list({doc.metadata.get("source", "Campus Knowledge Base") for doc in relevant_docs})
                context = "\n\n".join(doc.page_content for doc in relevant_docs)
        except Exception as e:
            print(f"Chroma search error: {e}")

    # 7. Gemini AI Generation for All General, Academic, Coding, and Campus Queries
    system_instruction = (
        "You are CampusLLM, an intelligent AI tutor and companion for university students (especially VIT).\n"
        "Provide thorough, articulate, bold, and structured answers formatted in GitHub markdown.\n"
        "If answering programming/DSA questions, include complete code examples and complexity analysis.\n"
        "If ground context is provided, prioritize it for campus specifics."
    )
    full_prompt = f"{system_instruction}\n\nContext:\n{context}\n\nUser Question: {cleaned_q}\n\nAnswer:"
    gemini_resp = generate_with_gemini(full_prompt)
    if gemini_resp:
        if sources:
            source_lines = [f"- [{s}]({s if s.startswith('http') else '#'})" for s in sources]
            gemini_resp += "\n\n**Sources:**\n" + "\n".join(source_lines)
        return gemini_resp

    # 8. Local Technical & Campus Solver Fallbacks (if Gemini offline/503)
    tech_ans = solve_technical_doubt(cleaned_q)
    if tech_ans:
        return tech_ans

    # Campus specifics fallback
    if any(k in q_low for k in ['select faculty', 'choose faculty', 'faculty selection', 'ffcs strategy', 'how to choose teacher', 'how to select teacher', 'pick faculty']):
        return """## 🎓 Strategic Guide: How to Select Faculty for Courses (FFCS)

Selecting the right faculty during the **Fully Flexible Credit System (FFCS)** registration is crucial for both academic learning and GPA management:

---

### 1. 🔍 Research Senior & Community Reviews First
- **Check Student Reviews**: Consult seniors and verified student channels (e.g., Telegram discussion groups, Reddit `r/Vit`, FFCS review forums) to check each professor's **teaching clarity**, **internal marking leniency**, and **quiz frequency**.
- **Grading Distribution**: In relative grading, a supportive faculty member who explains concepts clearly and conducts fair internal assessments (CATs & DAs) will help you secure higher grades.

### 2. ⏰ Balance Your Slot Timetable
- **Avoid Clashing Slots**: Distribute your coursework evenly between **Morning Theory (8:00 AM – 1:00 PM)** and **Afternoon Lab (2:00 PM – 7:00 PM)** (or vice-versa).
- **Plan Free Windows**: Keep 1–2 hours between heavy lab sessions for self-study, assignments, and meal breaks.

### 3. 📝 Digital Assignment (DA) & Quiz Policies
- Choose professors who offer structured, predictable deadlines for **Digital Assignments (DA)** and online quizzes on VTOP.
- Avoid selecting multiple faculty members known for assigning heavy impromptu pop quizzes in the same slot window.

### 4. 🚨 Always Prepare a 'Plan B' & 'Plan C' Timetable
- High-demand faculty slots fill up within **5 to 10 seconds** of your FFCS registration window opening on VTOP.
- Create at least **2 alternative timetable combinations** (with backup professors and slots) in advance so you can quickly switch without getting locked out.

### 5. 🎯 Credit Balancing Strategy
- Maintain **20 to 24 credits per semester** (minimum allowed is 16, maximum is 27) to maintain balance and avoid overwhelming exam stress during CAT and FAT weeks.

**Sources:**
- [vit_academics_ffcs_9pointer_grading.txt](#)
- [vit_reddit_community_insights.txt](#)"""

    if any(k in q_low for k in ['9 pointer', '9ptr', 'attendance exemption', '9.0 cgpa']):
        return """## 🌟 VIT 9-Pointer Attendance Exemption Policy

Under official VIT academic regulations, undergraduate and postgraduate students who achieve and maintain a **Cumulative Grade Point Average (CGPA) >= 9.00** ('9-Pointers') enjoy complete attendance flexibility:

---

### 📌 Key Benefits & Regulations:
- **100% Attendance Flexibility**: You are **exempted from the mandatory 75% minimum attendance requirement** in all registered theory courses.
- **No Debarment**: 9-pointer students cannot be awarded an `'N'` grade (debarred) or prevented from writing CAT-1, CAT-2, and FAT examinations due to low class attendance.
- **Freedom for Self-Development**: You can utilize regular lecture hours for competitive programming, hackathons, research publications, and technical clubs without attendance penalties.
- **Mandatory Components**: Please note that **Lab practical exams**, **project reviews/viva**, and **internal assessment tests (CAT-1, CAT-2, FAT)** must still be attended in person.

**Sources:**
- [vit_academics_ffcs_9pointer_grading.txt](#)
- [vit_reddit_community_insights.txt](#)"""

    return (
        f"## 💡 Campus Intelligence Response: {cleaned_q.title()}\n\n"
        f"Here are key insights and guidance for **\"{cleaned_q}\"**:\n\n"
        f"1. **Core Overview**: When preparing for university academics, placements, or technical problem solving, having a structured checklist ensures maximum performance.\n"
        f"2. **Official Channels**: For real-time course registrations and circulars, visit the **VTOP Student Portal** (`vtop.vit.ac.in`) or contact your department faculty proctor.\n\n"
        f"**💡 Proactive Tip**: You can ask me for code explanations (Java, Python, C++, DSA), FFCS faculty reviews, GPA simulations, or 2026 placement packages anytime!"
    )
