export type AnalyzerEngine = 'github' | 'gemini';

export interface SuggestedResult {
  suggestedTitle: string;
  descriptionEn: string;
  productTags: string[];
}

export interface TagStyle {
  backgroundColor: string | null;
  foregroundColor: string | null;
  imageUrl: string | null;
}
