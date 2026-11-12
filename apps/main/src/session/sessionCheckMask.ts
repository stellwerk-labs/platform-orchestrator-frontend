// AntD dialogs portal to body, outside the route subtree. Hide those too while
// the deadline is being checked, without unmounting forms and discarding drafts.
export const sessionCheckMask =
  'body > :not(#stellwerk-session-check) { display: none !important; }';
