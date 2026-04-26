export type TeachingSongStatus = 'draft' | 'published';

export interface TeachingSongManifest {
  id: string;
  slug: string;
  title: string;
  artist: string;
  copyright_status: string;
  difficulty: {
    overall: string;
    left_hand: string[];
    right_hand: string[];
  };
  key: string;
  bpm: number;
  time_signature: string;
  capo: number;
  core_chords: string[];
  structure: {
    name: string;
    start_bar: number;
    end_bar: number;
    demo_video?: string; // ✅ 为每段预留的视频演示 URL
    demo_audio?: string; // ✅ 为每段预留的音频演示 URL
  }[];
  learning_goals: string[];
  scale_suggestions: {
    primary: string;
    advanced?: string;
  };
  challenges: {
    title: string;
    section: string;
    bar_range: [number, number];
    demo_video?: string; // ✅ 为每个难点预留的特写视频 URL
    demo_audio?: string; // ✅ 为每个难点预留的慢速音频 URL
  }[];
  source_files: {
    base_gp5: string;
    full_video?: string; // ✅ 全曲完整演示视频
    full_audio?: string; // ✅ 全曲完整演示音频
  };
  status: TeachingSongStatus;
}

export interface TeachingSong {
  id: string;
  slug: string;
  title: string;
  artist: string;
  status: TeachingSongStatus;
  manifest: TeachingSongManifest;
  user_id: string;
  created_at: string;
  updated_at: string;
}
