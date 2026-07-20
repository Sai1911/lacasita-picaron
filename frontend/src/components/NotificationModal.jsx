// frontend/src/components/NotificationModal.jsx
import React from 'react';

const NotificationModal = ({ open, title, message, type = 'success', onClose }) => {
  if (!open) return null;

  const colorBar =
    type === 'error'
      ? 'bg-red-600'
      : type === 'warning'
      ? 'bg-yellow-500'
      : 'bg-emerald-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        {/* Barra superior de color */}
        <div className={`${colorBar} h-1 w-full`} />

        <div className="p-5 text-center">
          <h2 className="text-lg font-semibold mb-2 text-gray-800">
            {title}
          </h2>
          <p className="text-sm text-gray-600 mb-4">{message}</p>

          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#ff6600] hover:bg-[#e05500] text-white text-sm font-semibold transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
