import React from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { signOutUser } from "../lib/firebase";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  declare props: { children: React.ReactNode };
  state: ErrorBoundaryState = { hasError: false, errorMessage: "" };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Terjadi kesalahan tak terduga pada aplikasi."
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSignOutAndReload = async () => {
    try {
      await signOutUser();
    } catch {
      // Ignore signout errors during recovery
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      let friendlyMessage = "Terjadi kendala saat memuat atau menyinkronkan data aplikasi.";
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendlyMessage = `Akses database ditolak atau bermasalah (${parsed.operationType || "operasi"}: ${parsed.path || "-"}). Silakan muat ulang atau masuk kembali dengan akun Google Anda.`;
        }
      } catch {
        if (this.state.errorMessage) {
          friendlyMessage = this.state.errorMessage;
        }
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-5">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Terjadi Gangguan Koneksi Data
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {friendlyMessage}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang</span>
              </button>
              <button
                type="button"
                onClick={this.handleSignOutAndReload}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Ganti Akun</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
