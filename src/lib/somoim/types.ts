export type SomoimParticipant = {
  user_id: string;
  nickname: string;
  is_master: boolean;
  banned: boolean;
  os: string | null;
  rsvp_created: string | null;
};

export type SomoimEvent = {
  event_id: string;
  title: string;
  host_nickname: string;
  host_user_id: string;
  start_at: string | null;
  e_d: number;
  e_t: number;
  description: string;
  participant_count: number;
  participants: SomoimParticipant[];
};

export type SomoimGroupMember = {
  user_id: string;
  nickname: string;
  is_master: boolean;
  banned: boolean;
  os: string | null;
};

export type SomoimSnapshot = {
  captured_at: string;
  group_id: string;
  user_id: string;
  events: SomoimEvent[];
  stats: {
    event_count: number;
    total_participants: number;
  };
};
