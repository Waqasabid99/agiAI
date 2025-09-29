import { mount } from "./ChatbotWidget";

// Expose a global function that loader.js will call
window.ChatbotWidgetMount = (el, config) => {
  mount(el, config);
};
