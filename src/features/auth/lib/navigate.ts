// A full navigation: the end-session endpoint is another origin, so the router cannot do it. Separate module so tests can stub it.
const hardNavigate = (url: string): void => window.location.assign(url);

export { hardNavigate };
