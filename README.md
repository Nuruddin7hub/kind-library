# kind-library

A sleek, minimal personal library web app for browsing and reading course PDFs —
Flask backend + React/TypeScript (Vite) frontend.

## Setup

```sh
# backend
cd backend
python3 build_text_index.py   # builds the full-text index from YOUR pdfs
python3 app.py

# frontend
cd frontend
npm install
npm run dev
```

Place your PDFs in `backend/assets/pdfs/` (with page renders in
`backend/assets/pages/`) before building the index. **Course PDFs are
copyrighted material and are intentionally not included in this repo —
add your own.**
