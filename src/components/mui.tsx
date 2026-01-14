import React from "react";
import { useTranslation } from "react-i18next";
import MUIButton, { ButtonProps as MUIButtonProps } from "@mui/material/Button";
import TextField, { TextFieldProps } from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import MUISelect from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import MuiTooltipBase from "@mui/material/Tooltip";
import MuiSwitchBase, {
  SwitchProps as MuiSwitchProps,
} from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgressBase from "@mui/material/LinearProgress";
import MuiBox from "@mui/material/Box";
import MuiTypography, {
  TypographyProps as MuiTypographyProps,
} from "@mui/material/Typography";
import { Eye, EyeOff } from "lucide-react";

export const Button: React.FC<MUIButtonProps> = ({
  variant = "contained",
  color = "primary",
  children,
  ...props
}) => {
  return (
    <MUIButton variant={variant} color={color as any} {...props}>
      {children}
    </MUIButton>
  );
};

interface InputProps extends Omit<TextFieldProps, "onChange" | "error"> {
  label?: string;
  error?: string;
  containerClassName?: string;
  className?: string;
  icon?: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className,
  size = "small",
  type,
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);

  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  return (
    <div className={className}>
      <TextField
        label={label}
        error={!!error}
        helperText={error}
        variant="outlined"
        fullWidth
        size={size}
        type={inputType}
        InputProps={{
          startAdornment: icon ? (
            <InputAdornment position="start">{icon}</InputAdornment>
          ) : undefined,
          endAdornment: isPassword ? (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                onMouseDown={(e) => e.preventDefault()}
                edge="end"
                size="small"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconButton>
            </InputAdornment>
          ) : undefined,
          ...props.InputProps,
        }}
        {...props}
      />
    </div>
  );
};

export interface SelectOption {
  key: string;
  label?: string;
  labelKey?: string;
}

interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  renderLabel?: (option: SelectOption) => React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
}) => {
  const { t } = useTranslation();
  const handleChange = (e: any) => {
    onChange(e.target.value as string);
  };

  return (
    <FormControl fullWidth className={className} sx={{ minWidth: 120 }}>
      <MUISelect
        value={value}
        onChange={handleChange}
        displayEmpty
        size="small"
        sx={{
          borderRadius: "8px",
          "& .MuiSelect-select": {
            py: 0.75,
            fontSize: "0.875rem",
          },
        }}
      >
        {options.length === 0 && (
          <MenuItem value="">{placeholder || ""}</MenuItem>
        )}
        {options.map((opt) => (
          <MenuItem key={opt.key} value={opt.key}>
            {opt.label || (opt.labelKey ? t(opt.labelKey) : opt.key)}
          </MenuItem>
        ))}
      </MUISelect>
    </FormControl>
  );
};

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <MuiTooltipBase title={content}>
      <span>{children}</span>
    </MuiTooltipBase>
  );
};

export interface SwitchProps extends MuiSwitchProps {
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ label, ...props }) => {
  if (label) {
    return (
      <FormControlLabel
        control={<MuiSwitchBase {...props} />}
        label={<span style={{ fontSize: "0.875rem" }}>{label}</span>}
      />
    );
  }
  return <MuiSwitchBase {...props} />;
};

export const LinearProgress = LinearProgressBase;
export const Box = MuiBox;
export const Typography: React.FC<MuiTypographyProps> = (props) => (
  <MuiTypography {...props} />
);
