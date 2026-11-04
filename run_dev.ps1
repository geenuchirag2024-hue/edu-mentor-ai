Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "               Edu Mentor AI Starter                    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { Set-Location '$root'; .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload }"

Write-Host "Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { Set-Location '$root\frontend'; npm run dev }"

Write-Host ""
Write-Host "Both services launched in separate windows!" -ForegroundColor Yellow
Write-Host "Backend API docs: http://127.0.0.1:8000/docs" -ForegroundColor Gray
Write-Host "Frontend Web App: http://localhost:3000" -ForegroundColor Gray

