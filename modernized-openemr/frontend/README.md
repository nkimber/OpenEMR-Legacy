# Modernized OpenEMR Frontend

React and TypeScript frontend for the modernized OpenEMR target.

The first screen is the entry chooser for `Staff` and `Patient Portal`. It explains the automated modernization from OpenEMR to Modern OpenEMR, compares the original and modern technology stacks with versioned logo rows, and includes the project attribution footnote. Staff users authenticate through the core staff login page before the patient search and other staff modules render, and logging out returns to the chooser. The app calls the ASP.NET Core API through `VITE_API_BASE_URL`, defaulting to `http://localhost:5001`.

Run locally:

```powershell
npm install
npm run dev
```

Build:

```powershell
npm run build
```
