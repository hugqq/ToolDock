import React from "react";
import { useTranslation } from "react-i18next";
import MUIButton, { ButtonProps as MUIButtonProps } from "@mui/material/Button";
import MUITextField, { TextFieldProps } from "@mui/material/TextField";
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
      <MUITextField
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

// ========== 统一导出常用 MUI 组件 ==========
// 布局组件
export { default as Stack } from "@mui/material/Stack";
export { default as Grid } from "@mui/material/Grid";
export { default as Container } from "@mui/material/Container";
export { default as Paper } from "@mui/material/Paper";
export { default as Divider } from "@mui/material/Divider";

// 卡片组件
export { default as Card } from "@mui/material/Card";
export { default as CardContent } from "@mui/material/CardContent";
export { default as CardActions } from "@mui/material/CardActions";
export { default as CardHeader } from "@mui/material/CardHeader";

// 导航组件
export { default as Tabs } from "@mui/material/Tabs";
export { default as Tab } from "@mui/material/Tab";

// 表单组件
// 注意：TextField 也需要导出（项目中很多地方使用原生 TextField）
// Input 是我们自定义封装的组件（带密码显示切换等功能）
export { default as TextField } from "@mui/material/TextField";
export { default as ToggleButton } from "@mui/material/ToggleButton";
export { default as ToggleButtonGroup } from "@mui/material/ToggleButtonGroup";
export { default as Checkbox } from "@mui/material/Checkbox";
export { default as Radio } from "@mui/material/Radio";
export { default as RadioGroup } from "@mui/material/RadioGroup";
export { default as Slider } from "@mui/material/Slider";

// 反馈组件
export { default as Alert } from "@mui/material/Alert";
export { default as Snackbar } from "@mui/material/Snackbar";
export { default as CircularProgress } from "@mui/material/CircularProgress";
export { default as Backdrop } from "@mui/material/Backdrop";

// 弹窗组件
export { default as Dialog } from "@mui/material/Dialog";
export { default as DialogTitle } from "@mui/material/DialogTitle";
export { default as DialogContent } from "@mui/material/DialogContent";
export { default as DialogActions } from "@mui/material/DialogActions";

// 其他组件
export { default as Chip } from "@mui/material/Chip";
export { default as Badge } from "@mui/material/Badge";
export { default as Avatar } from "@mui/material/Avatar";
export { default as Fade } from "@mui/material/Fade";
export { default as Collapse } from "@mui/material/Collapse";
export { default as Grow } from "@mui/material/Grow";

