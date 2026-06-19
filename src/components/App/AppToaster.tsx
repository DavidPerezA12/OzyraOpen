import toast, { ToastBar, Toaster } from 'react-hot-toast';

interface AppToasterProps {
  readonly isDarkMode: boolean;
}

export function AppToaster({ isDarkMode }: AppToasterProps) {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={10}
      toastOptions={{
        duration: 3600,
        style: {
          padding: 0,
        },
        success: {
          iconTheme: { primary: '#10B981', secondary: '#ffffff' },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: '#ffffff' },
        },
      }}
    >
      {(toastItem) => (
        <div
          className={`oz-toast ${toastItem.visible ? 'oz-enter' : 'oz-leave'} ${
            isDarkMode ? 'oz-dark' : 'oz-light'
          }`}
        >
          <ToastBar
            toast={toastItem}
            style={{
              animation: 'none',
              background: 'transparent',
              boxShadow: 'none',
              padding: 0,
            }}
          >
            {({ icon, message }) => (
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="oz-icon">{icon}</div>
                <div className="oz-message flex-1">{message}</div>
                {toastItem.type !== 'loading' && (
                  <button
                    type="button"
                    onClick={() => toast.dismiss(toastItem.id)}
                    className={`ml-2 text-xs opacity-70 hover:opacity-100 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-600'
                    }`}
                    aria-label="Cerrar notificación"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        </div>
      )}
    </Toaster>
  );
}
