// Claims come from the e-INFRA profile; email may be absent, so every label falls back (displayName, email, "Account").
type SessionUser = {
  id: string;
  email?: string | undefined;
  displayName?: string | undefined;
  username?: string | undefined;
  roles?: string[] | undefined;
};

export type { SessionUser };
