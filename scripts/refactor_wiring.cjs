const fs = require('fs');
const path = require('path');

const plannerPath = path.join(__dirname, '../src/app/usePlannerWiring.ts');
let plannerContent = fs.readFileSync(plannerPath, 'utf8');

const replacements = {
    'i.locations': 'i.tripContext.locations',
    'i.setLocations': 'i.tripContext.setLocations',
    'i.vehicle': 'i.tripContext.vehicle',
    'i.setVehicle': 'i.tripContext.setVehicle',
    'i.settings': 'i.tripContext.settings',
    'i.setSettings': 'i.tripContext.setSettings',
    'i.customTitle': 'i.tripContext.customTitle',
    'i.summary': 'i.tripContext.summary',
    'i.canonicalTimeline': 'i.tripContext.canonicalTimeline',

    'i.tripMode': 'i.tripMode.tripMode',
    'i.showAdventureMode': 'i.tripMode.showAdventureMode',
    'i.setShowAdventureMode': 'i.tripMode.setShowAdventureMode',
    'i.showModeSwitcher': 'i.tripMode.showModeSwitcher',
    'i.setShowModeSwitcher': 'i.tripMode.setShowModeSwitcher',
    'i.modeSwitcherRef': 'i.tripMode.modeSwitcherRef',
    'i.handleSwitchMode': 'i.tripMode.handleSwitchMode',
    'i.tripActive': 'i.tripMode.tripActive',
    'i.setTripActive': 'i.tripMode.setTripActive',

    'i.previewGeometry': 'i.map.previewGeometry',
    'i.validRouteGeometry': 'i.map.validRouteGeometry',
    'i.routeFeasibilityStatus': 'i.map.routeFeasibilityStatus',
    'i.mapDayOptions': 'i.map.mapDayOptions',
    'i.handleMapClick': 'i.map.handleMapClick',
    'i.handleAddPOIFromMap': 'i.map.handleAddPOIFromMap',
    'i.adventurePreview': 'i.map.adventurePreview',

    'i.planningStep': 'i.wizard.planningStep',
    'i.completedSteps': 'i.wizard.completedSteps',
    'i.canProceedFromStep1': 'i.wizard.canProceedFromStep1',
    'i.canProceedFromStep2': 'i.wizard.canProceedFromStep2',
    'i.goToStep': 'i.wizard.goToStep',
    'i.goToNextStep': 'i.wizard.goToNextStep',
    'i.goToPrevStep': 'i.wizard.goToPrevStep',

    'i.isCalculating': 'i.calculation.isCalculating',
    'i.routeStrategies': 'i.calculation.routeStrategies',
    'i.activeStrategyIndex': 'i.calculation.activeStrategyIndex',
    'i.selectStrategy': 'i.calculation.selectStrategy',
    'i.strategicFuelStops': 'i.calculation.strategicFuelStops',
    'i.shareUrl': 'i.calculation.shareUrl',
    'i.showOvernightPrompt': 'i.calculation.showOvernightPrompt',
    'i.suggestedOvernightStop': 'i.calculation.suggestedOvernightStop',
    'i.dismissOvernightPrompt': 'i.calculation.dismissOvernightPrompt',
    'i.updateStopType': 'i.calculation.updateStopType',
    'i.calculateAndDiscover': 'i.calculation.calculateAndDiscover',

    'i.pois': 'i.poi.pois',
    'i.markerCategories': 'i.poi.markerCategories',
    'i.loadingCategory': 'i.poi.loadingCategory',
    'i.handleToggleCategory': 'i.poi.handleToggleCategory',
    'i.addedPOIIds': 'i.poi.addedPOIIds',
    'i.poiSuggestions': 'i.poi.poiSuggestions',
    'i.poiInference': 'i.poi.poiInference',
    'i.isLoadingPOIs': 'i.poi.isLoadingPOIs',
    'i.poiPartialResults': 'i.poi.poiPartialResults',
    'i.poiFetchFailed': 'i.poi.poiFetchFailed',
    'i.addPOI': 'i.poi.addPOI',
    'i.addStop': 'i.poi.addStop',
    'i.dismissPOI': 'i.poi.dismissPOI',

    'i.activePreset': 'i.presets.activePreset',
    'i.presetOptions': 'i.presets.presetOptions',
    'i.handlePresetChange': 'i.presets.handlePresetChange',
    'i.handleSharePreset': 'i.presets.handleSharePreset',
    'i.shareJustCopied': 'i.presets.shareJustCopied',

    'i.activeChallenge': 'i.tripLoader.activeChallenge',
    'i.tripOrigin': 'i.tripLoader.tripOrigin',
    'i.templateRecommendations': 'i.tripLoader.templateRecommendations',
    'i.pendingTemplate': 'i.tripLoader.pendingTemplate',
    'i.handleImportTemplate': 'i.tripLoader.handleImportTemplate',
    'i.handleTemplateLoaded': 'i.tripLoader.handleTemplateLoaded',
    'i.handleDismissPendingTemplate': 'i.tripLoader.handleDismissPendingTemplate',
    'i.handleSelectChallenge': 'i.tripLoader.handleSelectChallenge',
    'i.handleAdventureSelect': 'i.tripLoader.handleAdventureSelect',
    'i.setTripMode': 'i.tripLoader.setTripMode',

    'i.activeJournal': 'i.journal.activeJournal',
    'i.viewMode': 'i.journal.viewMode',
    'i.setViewMode': 'i.journal.setViewMode',
    'i.isJournalComplete': 'i.journal.isJournalComplete',
    'i.showCompleteOverlay': 'i.journal.showCompleteOverlay',
    'i.startJournal': 'i.journal.startJournal',
    'i.updateActiveJournal': 'i.journal.updateActiveJournal',
    'i.confirmComplete': 'i.journal.confirmComplete',
    'i.finalizeJournal': 'i.journal.finalizeJournal',
    'i.clearJournal': 'i.journal.clearJournal',

    'i.tripConfirmed': 'i.session.tripConfirmed',
    'i.setTripConfirmed': 'i.session.setTripConfirmed',
    'i.history': 'i.session.history',
    'i.hasActiveSession': 'i.session.hasActiveSession',
    'i.lastDestination': 'i.session.lastDestination',
    'i.resetTripSession': 'i.session.resetTripSession',
    'i.handleResumeSession': 'i.session.handleResumeSession',
    'i.restoreHistoryTripSession': 'i.session.restoreHistoryTripSession',
    'i.addedStopCount': 'i.session.addedStopCount',
    'i.externalStops': 'i.session.externalStops',

    'i.showVoila': 'i.voila.showVoila',
    'i.flyoverActive': 'i.voila.flyoverActive',
    'i.showShareScreen': 'i.voila.showShareScreen',
    'i.handleShowVoila': 'i.voila.handleShowVoila',
    'i.handleFlyoverComplete': 'i.voila.handleFlyoverComplete',
    'i.handleVoilaEdit': 'i.voila.handleVoilaEdit',
    'i.handleVoilaLockIn': 'i.voila.handleVoilaLockIn',
    'i.handleViewFullDetails': 'i.voila.handleViewFullDetails',
    'i.handleGoHome': 'i.voila.handleGoHome',
    'i.handleMinimizeToVoila': 'i.voila.handleMinimizeToVoila',
    'i.handleReturnToJournal': 'i.voila.handleReturnToJournal',
    'i.handleOpenShareScreen': 'i.voila.handleOpenShareScreen',
    'i.handleCloseShareScreen': 'i.voila.handleCloseShareScreen',

    'i.ghostCar': 'i.features.ghostCar',
    'i.icebreaker': 'i.features.icebreaker',

    'i.error': 'i.sys.error',
    'i.clearError': 'i.sys.clearError',
    'i.copyShareLink': 'i.sys.copyShareLink',
    'i.openInGoogleMaps': 'i.sys.openInGoogleMaps',
    'i.calculationMessage': 'i.sys.calculationMessage',
    'i.setMapRevealed': 'i.sys.setMapRevealed',
};

const regexPattern = Object.keys(replacements)
  .sort((a,b) => b.length - a.length)
  .map(k => k.replace(/([.])/g, '\\.'))
  .join('|');
// word boundary
const regex = new RegExp(`\\b(${regexPattern})\\b`, 'g');

function performReplacements(content) {
    return content.replace(regex, match => replacements[match]);
}

plannerContent = performReplacements(plannerContent);
fs.writeFileSync(plannerPath, plannerContent);

const appWiringPath = path.join(__dirname, '../src/app/useAppWiring.ts');
let appWiringContent = fs.readFileSync(appWiringPath, 'utf8');
appWiringContent = performReplacements(appWiringContent);
fs.writeFileSync(appWiringPath, appWiringContent);

console.log("Hooks refactored successfully in single pass.");
