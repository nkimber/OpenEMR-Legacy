# Modernized OpenEMR Frontend

React and TypeScript frontend for the modernized OpenEMR target.

The first implemented screen is the patient search and chart summary workspace. It calls the ASP.NET Core API through `VITE_API_BASE_URL`, defaulting to `http://localhost:5001`.

Run locally:

```powershell
npm install
npm run dev
```

Build:

```powershell
npm run build
```
