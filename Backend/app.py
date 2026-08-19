import os
import shutil
from typing import Annotated, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import engine, Base, SessionLocal, get_db, User, ChatSession, ChatMessage
from auth import (
    authenticate_user, create_access_token, get_password_hash,
    get_current_user, get_current_admin_user, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rag_pipeline import (
    rag_answer, ingest_document, extract_text_from_file,
    calculate_relative_grade, calculate_sgpa_cgpa
)

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CampusLLM Intelligent Backend Service",
    description="Context-grounded RAG API with Document/Image OCR, GPA Predictor & Auth",
    version="2.1.0",
)

@app.on_event("startup")
def seed_admin_account():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            new_admin = User(
                username="admin",
                hashed_password=get_password_hash("adminpassword123"),
                role="admin"
            )
            db.add(new_admin)
            db.commit()
            print("Seeded default fixed admin account (admin / adminpassword123)")
    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Schemas
# -------------------------

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str = "student"

class Token(BaseModel):
    access_token: str
    token_type: str

class QueryRequest(BaseModel):
    question: str

class GradeCalcRequest(BaseModel):
    cat1: float
    cat2: float
    da: float
    fat: float
    class_avg: Optional[float] = 65.0
    class_sd: Optional[float] = 12.0

class CourseItem(BaseModel):
    name: Optional[str] = "Course"
    credits: int
    grade: str

class GPACalcRequest(BaseModel):
    courses: list[CourseItem]
    previous_cgpa: Optional[float] = 0.0
    previous_credits: Optional[int] = 0

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

# -------------------------
# Auth Endpoints
# -------------------------

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        hashed_password=hashed_password,
        role="student"
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/register_admin", status_code=status.HTTP_201_CREATED)
def register_admin(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        hashed_password=hashed_password,
        role="admin"
    )
    db.add(new_user)
    db.commit()
    return {"message": "Admin user created successfully"}

@app.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ADMIN_EMAILS = [e.strip() for e in os.getenv("ADMIN_EMAILS", "admin@vit.ac.in,shri.sanjaykumar2022@vitstudent.ac.in").split(",") if e.strip()]

class GoogleAuthRequest(BaseModel):
    credential: str
    intended_role: Optional[str] = "student"

@app.post("/auth/google")
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            request.credential, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None
        )
        
        email = idinfo.get('email')
        if not email:
            raise ValueError("No email in token")
            
        if request.intended_role == "admin" and email not in ADMIN_EMAILS:
            raise HTTPException(status_code=403, detail="Unauthorized Email. You do not have Admin privileges.")
            
        username = email.split('@')[0]
        
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(username=username, hashed_password="GOOGLE_AUTH", role=request.intended_role)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if request.intended_role == "admin":
                if user.role != "admin":
                    if email in ADMIN_EMAILS:
                        user.role = "admin"
                        db.commit()
                    else:
                        raise HTTPException(status_code=403, detail="Unauthorized Email. You do not have Admin privileges.")
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer", "role": user.role}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role
    }

# -------------------------
# GPA & Grading Calculators
# -------------------------

@app.post("/calculate_grade")
def calculate_grade_endpoint(req: GradeCalcRequest):
    return calculate_relative_grade(
        cat1=req.cat1,
        cat2=req.cat2,
        da=req.da,
        fat=req.fat,
        class_avg=req.class_avg,
        class_sd=req.class_sd
    )

@app.post("/calculate_gpa")
def calculate_gpa_endpoint(req: GPACalcRequest):
    course_list = [{"name": c.name, "credits": c.credits, "grade": c.grade} for c in req.courses]
    return calculate_sgpa_cgpa(
        courses=course_list,
        prev_cgpa=req.previous_cgpa or 0.0,
        prev_credits=req.previous_credits or 0
    )

# -------------------------
# File Upload (Admin Knowledge Base)
# -------------------------

UPLOAD_DIR = "uploaded_files"
TEMP_DIR = "temp_user_attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

@app.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user)
):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        ingest_document(file_location)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
        
    return {"filename": file.filename, "status": "Uploaded and Indexed"}

class URLRequest(BaseModel):
    url: str

@app.post("/upload-url")
def upload_url_endpoint(
    request: URLRequest,
    current_user: User = Depends(get_current_admin_user)
):
    try:
        from rag_pipeline import ingest_url
        ingest_url(request.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL Ingestion failed: {str(e)}")
    
    return {"url": request.url, "status": "Uploaded and Indexed"}

@app.get("/files")
def list_files(current_user: User = Depends(get_current_admin_user)):
    try:
        files = []
        if os.path.exists(UPLOAD_DIR):
            for filename in os.listdir(UPLOAD_DIR):
                filepath = os.path.join(UPLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    files.append({
                        "filename": filename,
                        "size": os.path.getsize(filepath),
                        "uploaded_at": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                    })
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@app.delete("/files/{filename}")
def delete_file(filename: str, current_user: User = Depends(get_current_admin_user)):
    try:
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return {"message": f"File {filename} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

# -------------------------
# Chat Session Endpoints
# -------------------------

@app.get("/sessions", response_model=list[ChatSessionResponse])
def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()

@app.post("/sessions", response_model=ChatSessionResponse)
def create_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_session = ChatSession(user_id=current_user.id, title="New Chat")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}

class SessionUpdate(BaseModel):
    title: str

@app.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
def update_session(session_id: int, update_data: SessionUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = update_data.title
    db.commit()
    db.refresh(session)
    return session

@app.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
def get_session_messages(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.messages

@app.post("/sessions/{session_id}/ask")
def ask_rag_session(
    session_id: int,
    query: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.title == "New Chat":
        session.title = query.question[:30] + ("..." if len(query.question) > 30 else "")
        db.commit()

    user_msg = ChatMessage(session_id=session.id, role="user", content=query.question)
    db.add(user_msg)
    db.commit()

    try:
        answer = rag_answer(query.question)
    except Exception as e:
        answer = f"Error generating response: {str(e)}"
    
    asst_msg = ChatMessage(session_id=session.id, role="assistant", content=answer)
    db.add(asst_msg)
    db.commit()

    return {
        "question": query.question,
        "answer": answer,
    }

@app.post("/sessions/{session_id}/ask_with_attachment")
def ask_with_attachment(
    session_id: int,
    question: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    attachment_text = ""
    file_tag = ""
    if file:
        file_path = os.path.join(TEMP_DIR, f"{session_id}_{file.filename}")
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
        attachment_text = extract_text_from_file(file_path, file.filename)
        file_tag = f"\n\n📎 *[Attached: {file.filename}]*"

    display_user_msg = f"{question}{file_tag}"
    if session.title == "New Chat":
        session.title = question[:30] + ("..." if len(question) > 30 else "")
        db.commit()

    user_msg = ChatMessage(session_id=session.id, role="user", content=display_user_msg)
    db.add(user_msg)
    db.commit()

    try:
        answer = rag_answer(question, attachment_text=attachment_text)
    except Exception as e:
        answer = f"Error generating response: {str(e)}"
    
    asst_msg = ChatMessage(session_id=session.id, role="assistant", content=answer)
    db.add(asst_msg)
    db.commit()

    return {
        "question": display_user_msg,
        "answer": answer,
    }

@app.post("/ask")
def ask_rag_deprecated(
    query: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    answer = rag_answer(query.question)
    return {
        "question": query.question,
        "answer": answer,
    }

@app.get("/")
def root_status():
    return {"status": "CampusLLM RAG backend service is running", "version": "2.1.0"}

@app.get("/health")
def health_check():
    file_count = len(os.listdir(UPLOAD_DIR)) if os.path.exists(UPLOAD_DIR) else 0
    return {
        "status": "healthy",
        "service": "CampusLLM API",
        "files_indexed": file_count
    }
