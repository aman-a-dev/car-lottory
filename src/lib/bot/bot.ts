import "server-only"

// Side-effect imports: each handler file registers itself on the shared
// bot instance. Ordering matters only where two handlers could match the
// same update; commands run before the text catch-all.
import "./handlers/start"
import "./handlers/menu"
import "./handlers/lottery"
import "./handlers/purchase"
import "./handlers/tickets"
import "./handlers/profile"
import "./handlers/support"
import "./handlers/text-router"

export { bot } from "./instance"