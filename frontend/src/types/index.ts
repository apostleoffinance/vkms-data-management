export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "worker";
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface ChildSearchResult {
  id: string;
  child_code: string;
  first_name: string;
  last_name: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  is_active: boolean;
  pickup_contact_count?: number;
  pickup_photo_count?: number;
  has_pickup_photo?: boolean;
}

export interface ChildDetail {
  id: string;
  child_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  parent_id: string;
  class_id: string;
  medical_notes: string | null;
  registration_date: string;
  is_active: boolean;
  qr_code_data: string | null;
  created_at: string;
  updated_at: string;
  parent: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    alternative_phone: string | null;
    email: string | null;
    address: string | null;
    created_at: string;
  };
  class_name: string;
  total_visits: number;
  last_attendance_date: string | null;
  current_status: string;
  today_tag_number: string | null;
  today_service_name: string | null;
}

export interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  min_age: number;
  max_age: number;
  created_at: string;
}

export interface Service {
  id: string;
  service_name: string;
  service_date: string;
  created_at: string;
}

export interface TagPrint {
  tag_number: string;
  child_name: string;
  class_name: string;
  check_in_time: string;
  child_code: string;
}

export interface AuthorizedPickupContact {
  id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
  has_photo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  child_id: string;
  child_name: string;
  child_code: string;
  class_name: string;
  parent_name: string;
  service_id: string;
  tag_number: string;
  check_in_time: string;
  check_out_time: string | null;
  checked_out: boolean;
  checked_out_by_name: string | null;
  dropped_off_contact_id: string | null;
  dropped_off_contact_name: string | null;
  picked_up_contact_id: string | null;
  picked_up_contact_name: string | null;
  notes: string | null;
}

export interface DashboardStats {
  total_children: number;
  children_present_today: number;
  workers_present_today: number;
  new_children_this_month: number;
  average_weekly_attendance: number;
  currently_checked_in: number;
  already_checked_out: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface DashboardCharts {
  attendance_trend: ChartDataPoint[];
  class_distribution: ChartDataPoint[];
  worker_attendance_trend: ChartDataPoint[];
  new_registrations_trend: ChartDataPoint[];
}

export interface ExecutiveSummary {
  executive_summary: string;
  key_insights: string[];
  recommendations: string[];
}

export interface ExecutiveKpis {
  registered_children: number;
  children_present: number;
  workers_present: number;
  new_registrations_this_month: number;
  average_weekly_attendance: number;
  check_in_rate_pct: number;
  check_out_completion_pct: number | null;
  currently_checked_in: number | null;
  attendance_growth_pct: number | null;
  attendance_growth_vs: string | null;
  attendance_growth_note: string | null;
  worker_to_child_ratio: number | null;
}

export interface ExecutiveRetention {
  returning_count: number;
  first_check_in_ever_count: number;
  unique_children_present: number;
  retention_rate_pct: number | null;
  retention_note: string | null;
}

export interface ExecutiveClassBreakdown {
  class_name: string;
  present: number;
  registered: number;
}

export interface ExecutiveWorkerOnDuty {
  worker_name: string;
  check_in: string;
  service_date: string;
}

export interface ExecutiveAbsentChild {
  child_name: string;
  class_name: string;
  parent_name: string;
  phone: string;
  last_attendance: string;
}

export interface ExecutiveMetrics {
  report_period: string;
  period_label: string;
  service_name: string;
  kpis: ExecutiveKpis;
  retention: ExecutiveRetention;
  class_breakdown: ExecutiveClassBreakdown[];
  workers_on_duty: ExecutiveWorkerOnDuty[];
  absent_two_services: ExecutiveAbsentChild[];
  absent_two_services_count: number;
  charts: {
    attendance_trend: ChartDataPoint[];
    class_distribution: ChartDataPoint[];
    worker_trend: ChartDataPoint[];
  };
}

export interface ExecutiveReportData {
  metrics: ExecutiveMetrics;
  summary: ExecutiveSummary;
}

export interface WorkerRosterItem {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ParentLookup {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  alternative_phone: string | null;
  email: string | null;
  address: string | null;
  children: Array<{
    id: string;
    child_code: string;
    full_name: string;
    class_name: string;
    is_active: boolean;
  }>;
}

export interface Parent {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  alternative_phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  children?: Array<{
    id: string;
    child_code: string;
    full_name: string;
    class_name: string;
    is_active: boolean;
  }>;
}
