/** Legacy bot buttons used `catalog` for the primary launch: start on home now. */
const START_ROUTES = Object.freeze({
  home: '/', catalog: '/', bloggers: '/bloggers', admin: '/admin', form: '/', lead: '/',
});
export function launchRoute(param) {
  return Object.hasOwn(START_ROUTES, param) ? START_ROUTES[param] : null;
}
