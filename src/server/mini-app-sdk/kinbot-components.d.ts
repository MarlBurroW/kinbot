/**
 * @kinbot/components — TypeScript Definitions
 * React component library for KinBot mini-apps.
 */

import * as React from 'react';

// ─── Common ─────────────────────────────────────────────────────────────────

type BaseProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

// ─── Layout ─────────────────────────────────────────────────────────────────

export interface StackProps extends BaseProps {
  direction?: 'row' | 'column';
  gap?: string;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
}
export function Stack(props: StackProps): React.ReactElement;

export interface DividerProps extends Omit<BaseProps, 'children'> {
  orientation?: 'horizontal' | 'vertical';
}
export function Divider(props: DividerProps): React.ReactElement;

export interface GridProps extends BaseProps {
  columns?: number | string;
  minChildWidth?: string;
  gap?: string;
  rowGap?: string;
  colGap?: string;
}
export function Grid(props: GridProps): React.ReactElement;
export namespace Grid {
  interface ItemProps extends BaseProps {
    colSpan?: number;
    rowSpan?: number;
  }
  function Item(props: ItemProps): React.ReactElement;
}

// ─── Card ───────────────────────────────────────────────────────────────────

export interface CardProps extends BaseProps {
  hover?: boolean;
}
export function Card(props: CardProps): React.ReactElement;
export namespace Card {
  function Header(props: BaseProps): React.ReactElement;
  function Title(props: BaseProps): React.ReactElement;
  function Description(props: BaseProps): React.ReactElement;
  function Content(props: BaseProps): React.ReactElement;
  function Footer(props: BaseProps): React.ReactElement;
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export interface PanelProps extends BaseProps {
  title?: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'filled';
}
export function Panel(props: PanelProps): React.ReactElement;

// ─── Buttons ────────────────────────────────────────────────────────────────

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'>, BaseProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
export function Button(props: ButtonProps): React.ReactElement;

export interface ButtonGroupProps extends BaseProps {}
export function ButtonGroup(props: ButtonGroupProps): React.ReactElement;

// ─── Form Inputs ────────────────────────────────────────────────────────────

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
}
export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  label?: string;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
}
export const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;

export interface SelectOption {
  value: string;
  label: string;
}
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'style'> {
  label?: string;
  options?: SelectOption[];
  placeholder?: string;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
}
export const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style' | 'type'> {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Checkbox(props: CheckboxProps): React.ReactElement;

export interface SwitchProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Switch(props: SwitchProps): React.ReactElement;

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface RadioGroupProps {
  name?: string;
  options?: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  direction?: 'row' | 'column';
  label?: string;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function RadioGroup(props: RadioGroupProps): React.ReactElement;

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Slider(props: SliderProps): React.ReactElement;

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  type?: 'date' | 'datetime-local' | 'time';
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function DatePicker(props: DatePickerProps): React.ReactElement;

// ─── Form Compound Component ────────────────────────────────────────────────

export type ValidationRule =
  | 'required'
  | 'email'
  | { type: 'minLength'; value: number; message?: string }
  | { type: 'maxLength'; value: number; message?: string }
  | { type: 'min'; value: number; message?: string }
  | { type: 'max'; value: number; message?: string }
  | { type: 'pattern'; value: RegExp; message?: string }
  | { type: 'match'; value: string; message?: string }
  | ((value: unknown, allValues: Record<string, unknown>) => string | null);

export interface FormRenderProps {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  submitting: boolean;
  reset: () => void;
}

export interface FormProps extends BaseProps {
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  initialValues?: Record<string, unknown>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  children?: React.ReactNode | ((props: FormRenderProps) => React.ReactNode);
}
export function Form(props: FormProps): React.ReactElement;
export namespace Form {
  interface FieldProps extends BaseProps {
    name: string;
    label?: string;
    rules?: ValidationRule[];
    helpText?: string;
  }
  function Field(props: FieldProps): React.ReactElement;

  interface ActionsProps extends BaseProps {
    align?: 'left' | 'center' | 'right' | 'between';
  }
  function Actions(props: ActionsProps): React.ReactElement;

  interface SubmitProps extends ButtonProps {
    loadingText?: string;
  }
  function Submit(props: SubmitProps): React.ReactElement;

  function Reset(props: ButtonProps): React.ReactElement;
}

// ─── Data Display ───────────────────────────────────────────────────────────

export interface BadgeProps extends BaseProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}
export function Badge(props: BadgeProps): React.ReactElement;

export interface TagProps extends BaseProps {
  onRemove?: () => void;
  variant?: string;
}
export function Tag(props: TagProps): React.ReactElement;

export interface StatProps extends BaseProps {
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
}
export function Stat(props: StatProps): React.ReactElement;

export interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}
export function Avatar(props: AvatarProps): React.ReactElement;

export interface TooltipProps extends BaseProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}
export function Tooltip(props: TooltipProps): React.ReactElement;

export interface ProgressBarProps {
  value?: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function ProgressBar(props: ProgressBarProps): React.ReactElement;

// ─── Tables & Lists ─────────────────────────────────────────────────────────

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface TableProps<T = unknown> extends BaseProps {
  columns?: TableColumn<T>[];
  data?: T[];
  onRowClick?: (row: T, index: number) => void;
}
export function Table<T = unknown>(props: TableProps<T>): React.ReactElement;

export interface ListItem {
  id?: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
}
export interface ListProps extends BaseProps {
  items?: ListItem[];
  divided?: boolean;
}
export function List(props: ListProps): React.ReactElement;

export interface DataGridColumn<T = unknown> extends TableColumn<T> {
  sortable?: boolean;
  filterable?: boolean;
}
export interface DataGridProps<T = unknown> extends BaseProps {
  columns: DataGridColumn<T>[];
  data: T[];
  pageSize?: number;
  pageSizeOptions?: number[];
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  onRowClick?: (row: T, index: number) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  striped?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
}
export function DataGrid<T = unknown>(props: DataGridProps<T>): React.ReactElement;

// ─── Feedback ───────────────────────────────────────────────────────────────

export interface AlertProps extends BaseProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}
export function Alert(props: AlertProps): React.ReactElement;

export interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Spinner(props: SpinnerProps): React.ReactElement;

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Skeleton(props: SkeletonProps): React.ReactElement;

export interface EmptyStateProps extends BaseProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState(props: EmptyStateProps): React.ReactElement;

// ─── Navigation ─────────────────────────────────────────────────────────────

export interface TabDef {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}
export interface TabsProps extends BaseProps {
  tabs?: TabDef[];
  active?: string;
  onChange?: (tabId: string) => void;
}
export function Tabs(props: TabsProps): React.ReactElement;

export interface PaginationProps extends BaseProps {
  page?: number;
  totalPages?: number;
  onChange?: (page: number) => void;
}
export function Pagination(props: PaginationProps): React.ReactElement;

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}
export interface BreadcrumbsProps extends BaseProps {
  items?: BreadcrumbItem[];
  separator?: string;
}
export function Breadcrumbs(props: BreadcrumbsProps): React.ReactElement;

// ─── Overlays ───────────────────────────────────────────────────────────────

export interface ModalProps extends BaseProps {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
export function Modal(props: ModalProps): React.ReactElement;

export interface DrawerProps extends BaseProps {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  side?: 'left' | 'right';
  width?: string;
}
export function Drawer(props: DrawerProps): React.ReactElement;

export interface PopoverProps extends BaseProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function Popover(props: PopoverProps): React.ReactElement;

// ─── Accordion & Dropdown ───────────────────────────────────────────────────

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}
export interface AccordionProps extends BaseProps {
  items?: AccordionItem[];
  multiple?: boolean;
  defaultOpen?: string[];
}
export function Accordion(props: AccordionProps): React.ReactElement;

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}
export interface DropdownMenuProps extends BaseProps {
  trigger: React.ReactNode;
  items?: DropdownMenuItem[];
  align?: 'start' | 'end';
}
export function DropdownMenu(props: DropdownMenuProps): React.ReactElement;

// ─── Charts ─────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showValues?: boolean;
  showGrid?: boolean;
  barRadius?: number;
  gap?: number;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function BarChart(props: BarChartProps): React.ReactElement;

export interface LineChartDataPoint {
  label: string;
  value?: number;
  values?: number[];
}
export interface LineChartProps {
  data: LineChartDataPoint[];
  series?: string[];
  width?: number;
  height?: number;
  showDots?: boolean;
  showArea?: boolean;
  curved?: boolean;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function LineChart(props: LineChartProps): React.ReactElement;

export interface PieChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  donut?: boolean;
  showLabels?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function PieChart(props: PieChartProps): React.ReactElement;

export interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}
export function SparkLine(props: SparkLineProps): React.ReactElement;

// ─── Stepper ────────────────────────────────────────────────────────────────

export interface StepDef {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}
export interface StepperProps extends BaseProps {
  steps?: StepDef[];
  activeStep?: number;
  onStepClick?: (index: number) => void;
  variant?: 'default' | 'compact';
  allowClickAhead?: boolean;
}
export function Stepper(props: StepperProps): React.ReactElement;

export interface StepperContentProps extends BaseProps {
  activeStep?: number;
  animated?: boolean;
}
export function StepperContent(props: StepperContentProps): React.ReactElement;
