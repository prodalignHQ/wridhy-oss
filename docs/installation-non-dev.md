# MoMoney for Non-Developers: Quick Start Guide

MoMoney can be run as a **single, standalone application** on your computer. You don't need to know how to code, install database servers, or run complicated terminal commands.

---

## 1. What You Get

- **Single Application File**: Everything (the web app, the server, and the database engine) is packed into one single file.
- **Zero Cloud Tracking**: Your financial data stays 100% on your own computer.
- **Automatic Browser Launch**: When you start MoMoney, it automatically opens your web browser to your financial dashboard.

---

## 2. Download and Run

### macOS (Apple Silicon / M1 / M2 / M3 / M4)

1. Download the `momoney` application binary.
2. Open your **Terminal** app (press `Cmd + Space`, type `Terminal`, and press `Enter`).
3. Allow the binary to run (macOS requires this for standalone apps downloaded from the internet):
   ```bash
   chmod +x ~/Downloads/momoney
   xattr -cr ~/Downloads/momoney
   ```
4. Double-click the file in Finder, or run:
   ```bash
   ~/Downloads/momoney
   ```
5. Your browser will automatically open to `http://localhost:3000`. You're ready to manage your money!

---

### Linux (x86_64 / amd64)

1. Download the `momoney-linux-x64` file.
2. Open a terminal and grant execute permissions:
   ```bash
   chmod +x momoney-linux-x64
   ```
3. Run the application:
   ```bash
   ./momoney-linux-x64
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

### Windows (x64)

1. Download `momoney-windows-x64.exe`.
2. Double-click `momoney-windows-x64.exe` to run.
3. If Windows SmartScreen shows a prompt, click **More info** $\rightarrow$ **Run anyway**.
4. Your browser will open automatically to `http://localhost:3000`.

---

## 3. Where is My Data Stored?

All your financial accounts, categorized transactions, statements, and rules are saved in a single file on your computer:

| Operating System | Default Database Location |
| :--- | :--- |
| **macOS** | `~/.momoney/momoney.db` |
| **Linux** | `~/.momoney/momoney.db` |
| **Windows** | `C:\Users\<YourUsername>\.momoney\momoney.db` |

> [!TIP]
> **Custom Database Location**: If you want to store your database in a specific location (for example, in your Google Drive or Dropbox folder for automatic sync), start MoMoney with the `SQLITE_DB_PATH` environment variable:
> ```bash
> SQLITE_DB_PATH="/path/to/my-finances.db" ./momoney
> ```

---

## 4. Backups & Portability

Backing up your entire financial history takes 5 seconds:

1. Close MoMoney (press `Ctrl + C` in the terminal window).
2. Copy the file `~/.momoney/momoney.db` to an external hard drive, iCloud, Google Drive, or Dropbox.
3. To restore or move your data to a new computer, simply copy `momoney.db` into the `~/.momoney/` folder on the new computer.
