export type Role = "super_admin" | "admin" | "inspector" | "viewer";
export type InspectionStatus = "PASS" | "FAIL" | "REVIEW";
export interface Profile { id: string; full_name: string | null; email: string | null; role: Role; is_active: boolean; avatar_url?: string | null }
export interface Detection { label: string; confidence: number; bbox: number[] }
export interface InspectionResult {
  id: string; status: InspectionStatus; quality_score: number; defect_count: number;
  max_confidence: number | null; model_version: string; detections: Detection[];
  original_url: string | null; annotated_url: string | null;
}
export interface ModelStatus { available: boolean; model_version: string; classes: string[]; error: string | null; demo_enabled?: boolean; setup_hint: string | null }
