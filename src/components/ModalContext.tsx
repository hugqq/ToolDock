/**
 * 弹窗上下文管理器
 * 提供全局可调用的确认对话框能力
 */
import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal, ModalProps } from "./Modal";

interface ModalContextType {
  confirm: (
    options: Omit<ModalProps, "isOpen" | "onClose" | "onConfirm">
  ) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [modalConfig, setModalConfig] = useState<ModalProps | null>(null);

  const confirm = useCallback(
    (options: Omit<ModalProps, "isOpen" | "onClose" | "onConfirm">) => {
      return new Promise<boolean>((resolve) => {
        setModalConfig({
          ...options,
          isOpen: true,
          onClose: () => {
            setModalConfig(null);
            resolve(false);
          },
          onConfirm: () => {
            setModalConfig(null);
            resolve(true);
          },
        });
      });
    },
    []
  );

  return (
    <ModalContext.Provider value={{ confirm }}>
      {children}
      {modalConfig && <Modal {...modalConfig} />}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};
