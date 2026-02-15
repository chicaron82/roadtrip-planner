import { useState, useEffect } from 'react';
import { Bot, Key, ExternalLink, Check, X, Loader2, Shield } from 'lucide-react';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Switch } from '../UI/Switch';
import { Select } from '../UI/Select';
import {
  type AIConfig,
  type AIProvider,
  getAIConfig,
  saveAIConfig,
  clearAIConfig,
  validateApiKey,
  DEFAULT_MODELS,
  PROVIDER_INFO,
} from '../../lib/ai-config';
import { testConnection } from '../../lib/ai-service';
import { cn } from '../../lib/utils';

interface AISettingsProps {
  onConfigChange?: (config: AIConfig | null) => void;
}

export function AISettings({ onConfigChange }: AISettingsProps) {
  const [config, setConfig] = useState<AIConfig>(() => {
    const saved = getAIConfig();
    return saved || {
      enabled: false,
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-4-5-20250514',
    };
  });

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keyValidation, setKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);

  // Validate key on change
  useEffect(() => {
    if (config.apiKey) {
      const result = validateApiKey(config.provider, config.apiKey);
      setKeyValidation(result);
    } else {
      setKeyValidation(null);
    }
    setTestResult(null);
  }, [config.apiKey, config.provider]);

  const handleSave = () => {
    if (config.enabled && !config.apiKey) {
      return; // Don't save if enabled but no key
    }
    saveAIConfig(config);
    onConfigChange?.(config);
  };

  const handleClear = () => {
    clearAIConfig();
    setConfig({
      enabled: false,
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-4-5-20250514',
    });
    setTestResult(null);
    setKeyValidation(null);
    onConfigChange?.(null);
  };

  const handleTest = async () => {
    if (!config.apiKey) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const providerInfo = PROVIDER_INFO[config.provider];
  const models = DEFAULT_MODELS[config.provider];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">AI Trip Assistant</h3>
          <p className="text-xs text-muted-foreground">BYOK - Bring Your Own Key</p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">Enable AI Features</div>
            <div className="text-xs text-muted-foreground">Natural language planning & smart suggestions</div>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
        />
      </div>

      {config.enabled && (
        <>
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>AI Provider</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((provider) => {
                const info = PROVIDER_INFO[provider];
                const isSelected = config.provider === provider;
                return (
                  <button
                    key={provider}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      provider,
                      model: DEFAULT_MODELS[provider][0],
                    }))}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="text-2xl mb-1">{info.emoji}</div>
                    <div className="text-xs font-medium">{info.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="h-3 w-3" />
                API Key
              </Label>
              <a
                href={providerInfo.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Get a key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder={`Enter your ${providerInfo.name} API key`}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Key Validation Feedback */}
            {keyValidation && (
              <div className={cn(
                "text-xs flex items-center gap-1",
                keyValidation.valid ? "text-green-600" : "text-amber-600"
              )}>
                {keyValidation.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {keyValidation.message}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              id="model"
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
            >
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100 text-green-800">
            <Shield className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <div className="font-medium mb-1">Your Privacy is Protected</div>
              <p>Your API key stays on your device and is never sent to our servers. All AI requests go directly from your browser to {providerInfo.name}.</p>
            </div>
          </div>

          {/* Test Connection */}
          {testResult && (
            <div className={cn(
              "p-3 rounded-lg border text-sm",
              testResult.success
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            )}>
              {testResult.success ? (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {testResult.message}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!config.apiKey || testing}
              className="flex-1"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={config.enabled && !config.apiKey}
              className="flex-1"
            >
              Save Settings
            </Button>
          </div>

          {getAIConfig() && (
            <Button
              variant="ghost"
              onClick={handleClear}
              className="w-full text-destructive hover:text-destructive"
            >
              Clear API Key & Disable
            </Button>
          )}
        </>
      )}
    </div>
  );
}
