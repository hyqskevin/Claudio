import { useEffect, useCallback } from "react";

interface SlideUpPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function SlideUpPanel({ visible, onClose, title, children }: SlideUpPanelProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <div className="slide-up-overlay" onClick={onClose}>
      <div className="slide-up-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-up-handle" />
        <div className="slide-up-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
