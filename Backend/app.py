import os
import shutil
from typing import Annotated
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import engine, Base, get_db, User, ChatSession, ChatMessage
from datetime import datetime
from auth import authenticate_user, create_access_token, get_password_hash, get_current_user, get_current_admin_user, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rag_pipeline import rag_answer, ingest_document

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RAG Backend Service",
    description="Context-grounded RAG API with Auth & Roles",
    version="2.0.0",
)

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
    role: str = "student"  # default to student

class Token(BaseModel):
    access_token: str
    token_type: str

class QueryRequest(BaseModel):
    question: str

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
        role="student"  # Force student role regardless of input
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
        role="admin"  # Force admin role
    )
    db.add(new_user)
    db.commit()
    return {"message": "Admin user created successfully"}

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class GoogleAuthRequest(BaseModel):
    credential: str
    intended_role: str = "student"

ADMIN_EMAILS = ["shrisanjaykumar06@gmail.com"]

@app.post("/auth/google")
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            request.credential, 
            google_requests.Request(), 
            "59750816458-4nojl83ujddkh23qrllkab9807rthupv.apps.googleusercontent.com"
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
# File Upload (Admin Only)
# -------------------------

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user)
):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Ingest into RAG
    try:
        ingest_document(file_location)
    except Exception as e:
        # cleanup if failed (optional)
        # os.remove(file_location)
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

# -------------------------
# RAG Endpoint
# -------------------------

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

# -------------------------
# Chat Session Endpoints
# -------------------------

@app.get("/sessions", response_model=list[ChatSessionResponse])
def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    return sessions

@app.post("/sessions", response_model=ChatSessionResponse)
def create_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_session = ChatSession(user_id=current_user.id, title="New Chat")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

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
    
    # Update title if it's "New Chat" and this is the first message
    if session.title == "New Chat":
        session.title = query.question[:30] + ("..." if len(query.question) > 30 else "")
        db.commit()

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=query.question)
    db.add(user_msg)
    db.commit()

    # Call RAG
    try:
        answer = rag_answer(query.question)
    except Exception as e:
        answer = f"Error generating response: {str(e)}"
    
    # Save assistant message
    asst_msg = ChatMessage(session_id=session.id, role="assistant", content=answer)
    db.add(asst_msg)
    db.commit()

    return {
        "question": query.question,
        "answer": answer,
    }

@app.get("/")
def health_check():
    return {"status": "RAG service v2 is running"}
