import { createInteractionEffects } from './effects/controller.js';
// Compatibility facade for existing teacher, student and race controllers.
window.interactionEffects = createInteractionEffects({ settings: () => window.appSettings.values });
