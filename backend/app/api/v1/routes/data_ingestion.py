from fastapi import APIRouter, File, UploadFile, Response, Request, HTTPException

router = APIRouter(prefix="/dataset")

@router.post("/upload")
def upload_file(file: UploadFile = File(...)):
    return {"message": "File uploaded successfully"}