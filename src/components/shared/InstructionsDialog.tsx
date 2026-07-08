import { useState } from "react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { BookOpenText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "../mui";

export interface InstructionStep {
  title: string;
  description: string;
}

interface InstructionsDialogProps {
  title: string;
  steps: InstructionStep[];
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  className?: string;
}

export const InstructionsDialog: FC<InstructionsDialogProps> = ({
  title,
  steps,
  triggerLabel = title,
  triggerIcon: TriggerIcon = BookOpenText,
  className,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={handleOpen}
        title={title}
        startIcon={<TriggerIcon size={16} />}
        className={className}
        sx={{
          minWidth: "auto",
          px: 1.25,
          py: 0.75,
          borderRadius: "10px",
          color: "primary.main",
          textTransform: "none",
          fontWeight: 700,
          "&:hover": {
            bgcolor: "rgba(59,130,246,0.14)",
          },
        }}
      >
        {triggerLabel}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {steps.map((step, index) => (
              <div
                key={`${step.title}-${index}`}
                className="rounded-xl border border-(--border-color) bg-(--bg-main) p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-(--text-main) mb-1">
                      {step.title}
                    </div>
                    <div className="text-sm leading-6 text-(--text-muted)">
                      {step.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            {t("common.close")}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
};
