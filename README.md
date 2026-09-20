## About The Project

**Automation Suite Pro** is a high-performance, standalone Adobe Illustrator script (`.jsx`) built to eliminate repetitive production workflows for vector artists, microstock creators (Adobe Stock, Freepik, Shutterstock), and Amazon KDP publishers. 

It unifies deep vector sanitization, artboard standardization, batch layout generation, and procedural artwork creation into a single modular ScriptUI dashboard.

### Core Automation Engines

- **🪄 Intelligent BG Remover:** Removes canvas and card background bounding boxes while safeguarding foreground white artwork, highlights, and intentional vector paths.
- **📐 Microstock Page Resizer:** Centers, scales, and adapts vectors into industry-standard dimensions (e.g., 4000 × 2663 px, 1000 × 350 px banner, or 4000 × 4000 px square) with uniform safe margins and zero distortion.
- **🛠️ Quality Issue Solver (Stock Compliance Fixer):** Eliminates common microstock rejection causes by purging stray points, unpainted ghost paths, and empty clipping masks while auto-outlining fonts. Includes an automated clustering engine to split multi-icon sheets into individual standalone assets.
- **🧩 Icon Set Maker Pro:** Automatically arranges icon collections into structured, transparent grid sheets (5×3, 5×2, 4×3, or custom cell counts) without background artifacts.
- **📖 Amazon KDP Interior Generator:** A book publishing pipeline that generates multi-artboard journal and workbook interiors with custom trim sizes (6×9", 8.5×11", square), gutter-safe margins, automated pagination, and single-click print-ready PDF/EPS exports.
- **🎨 Procedural Gradient Maker:** Generates unique, non-repeating mesh and radial gradient backgrounds across procedural themes (*Holographic Fluid*, *Deep Space*, *Quantum Aurora*, and *Bioluminescent*).

### Built With

- **Language:** JavaScript / Adobe ExtendScript (`#target illustrator`)
- **UI Framework:** Adobe ScriptUI (Tabbed fixed-dimension layout with zero-jitter navigation)
- **Supported Hosts:** Adobe Illustrator CS6 through CC (macOS & Windows)
- **Export Standards:** Illustrator 10 EPS, Master AI, SVG, PNG-24, and Print PDF
