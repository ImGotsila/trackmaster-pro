<div align="center">
  <img width="1200" height="475" alt="TrackMaster Pro Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <h1>🚚 TrackMaster Pro v4.0</h1>
  <p><b>Advanced E-commerce Logistics Analytics & Intelligence Dashboard</b></p>
  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  </p>
</div>

---

## 🌟 Overview

**TrackMaster Pro** is a comprehensive logistics intelligence platform designed for Thai e-commerce businesses. It transforms messy courier data into actionable insights using high-precision maps, financial analytics, and robust visual dashboards.

## 🚀 Key Features

### 📍 Advanced Map Analytics v4.0 (Heatmap)
- **Zip-Code Precision:** Visualize order density across every district in Thailand.
- **Dynamic Legend Sizing:** Pins resize automatically based on zoom levels for clarity.
- **Multi-level Color Scaling:** Heatmap shifts from Indigo to Hot Red based on volume.
- **Volume Filters:** Filter to show only high-traffic areas (e.g., >50 orders).

### 💰 Financial & Cost Intelligence
- **Shipping Cost Heatmap:** Identify the most expensive vs. cheapest shipping zones.
- **Dynamic COD Fee Management:** Admins can adjust the system-wide COD fee (standard 3%).
- **Net Profit Engine:** Automatically calculates profit using: `COD - Cost - (COD * Fee%)`.
- **ROI Tracking:** Month-over-month performance and return-on-investment metrics.

### 📊 Visual Dashboard (Interactive Charts)
- **Daily Volume Trends:** Track scaling performance over 15-day rolling windows.
- **Courier Market Share:** Analyze carrier split (Flash, J&T, Kerry, etc.) to optimize choice.
- **Performance Distribution:** Compare Avg. COD vs. Avg. Net Profit per unit.

### 🛡️ Admin & Security Layer
- **Role-Based Access (RBAC):** Separate permissions for Admins and standard Users.
- **User Management:** Create/Delete users and change roles directly via the UI.
- **System Config:** Manage global thresholds and system parameters from a central panel.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide React.
- **Visualization:** Leaflet (Maps), Recharts (Analytical Charts).
- **Backend:** Node.js, Express, SQLite (better-sqlite3).
- **Deployment:** Docker & PowerShell automation.

---

## 🏁 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd trackmaster-pro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file:
   ```env
   PORT=3000
   ```

4. **Launch Development Server:**
   ```bash
   npm run dev
   ```

---

## 🔑 Default Credentials

> [!IMPORTANT]
> Change these immediately after your first login in the **Admin Settings**.

- **URL:** `http://localhost:3000`
- **Username:** `admin`
- **Password:** `admin1234`

---

## 🚢 Deployment

TrackMaster Pro includes a dedicated PowerShell script for automated NAS/Docker deployment:

```powershell
./deploy_to_nas.ps1
```

This will:
1. Build the production bundle.
2. Package the app for cross-platform transfer.
3. Upload and restart the container on your remote server.

---

<div align="center">
  <p>© 2026 Advanced Agentic Coding Team - Powering High-Performance Logistics</p>
</div>
