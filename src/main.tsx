// 1) Beta storage isolation MUST run before any store module is evaluated. A static import is not enough:
//    the bundler puts the stores in a shared chunk that is evaluated BEFORE this file's own code, so beta
//    used to hydrate from the live copy on every load (beta changes — units, profile — lost on reload).
// 2) Everything else is loaded after it.
import './lib/betaIsolation'
import './index.css'
void import('./boot')
