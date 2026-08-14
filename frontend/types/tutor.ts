export type TutorMode = "teacher" | "doubt_solver" | "quiz_master" | "interviewer";

export interface QuizQuestion {
  id: string;
  type: "mcq" | "true_false" | "short" | string;
  prompt: string;
  options: string[];
  explanation?: string;
  subtopic?: string;
}

export interface QuizPayload {
  quiz_id: string;
  subject: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

export interface QuizGradeResult {
  quiz_id: string;
  score: number;
  total: number;
  accuracy: number;
  weak_areas: string[];
  details: {
    id: string;
    prompt: string;
    type: string;
    given: string;
    correct_answer: string;
    is_correct: boolean;
    explanation: string;
    subtopic: string;
  }[];
  mascot_message: string;
  emotion: string;
  gesture: string;
  difficulty: string;
}

export interface ProgressDashboard {
  learner_id: string;
  xp: number;
  level: number;
  xp_into_level: number;
  xp_per_level: number;
  streak_days: number;
  difficulty: string;
  questions_answered: number;
  quizzes_completed: number;
  quiz_accuracy: number;
  topics: {
    name: string;
    correct: number;
    incorrect: number;
    studied: number;
    accuracy: number | null;
    mastery: number;
    last_studied: string | null;
  }[];
  strongest_topic: string | null;
  needs_improvement: string | null;
  badges: { id: string; label: string }[];
  interviews_completed: number;
}

export interface InterviewStart {
  interview_id: string;
  topic: string;
  question_number: number;
  total: number;
  prompt: string;
  finished: boolean;
  emotion?: string;
  gesture?: string;
}

export interface InterviewTurnResult {
  interview_id: string;
  question_number: number;
  total: number;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  finished: boolean;
  next_prompt: string | null;
  average_score?: number;
  mascot_message?: string;
  turns?: { prompt: string; answer: string; score: number; feedback: string }[];
  emotion?: string;
  gesture?: string;
}

export interface NotesUploadResult {
  doc_id: string;
  filename: string;
  chunks: number;
  session_id: string;
  used_embeddings: boolean;
}
