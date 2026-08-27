import plugin from "./tui.js";

export default {
  id: plugin.id,
  setup(context) {
    if (!context?.storage?.store) return;
    return plugin.setup(context);
  },
};
