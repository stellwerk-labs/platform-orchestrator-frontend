import { Alert, Card, Modal, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';

import { invokeBridgeOperation, type PluginDeploymentMaterial } from './hostOperationInvocation';
import {
  bridgeOperationDescriptors,
  coreOrgRoute,
  isExpectedPluginReadyEvent,
  normalizePluginRoutePrefix,
  pluginHostRoute,
  validatePluginBridgeRequest,
  validatePluginFrameUrl,
} from './pluginValidation';
import { type PluginDescriptor, pluginUiSdkVersion } from './types';

interface PluginFrameProps {
  orgId: string;
  plugin: PluginDescriptor;
}

const bridgeError = (requestId: string | undefined, nonce: string, error: string) => ({
  type: 'stellwerk.host.operation.response',
  sdk_version: pluginUiSdkVersion,
  nonce,
  request_id: requestId,
  error,
});

export const PluginFrame = ({ orgId, plugin }: PluginFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | undefined>(undefined);
  const handshakeTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const nonceRef = useRef('');
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useUserPreferencesStore(({ theme: currentTheme }) => currentTheme);
  const [bridgeFailure, setBridgeFailure] = useState<string>();
  const [visibleLogs, setVisibleLogs] = useState<PluginDeploymentMaterial>();
  const descriptorRevision = useMemo(
    () =>
      JSON.stringify([plugin.state, plugin.mode, plugin.operations, plugin.ui?.core_operations]),
    [plugin.mode, plugin.operations, plugin.state, plugin.ui?.core_operations],
  );
  const frameUrl = useMemo(() => {
    if (!plugin.ui) throw new Error('The plugin has no registered UI contribution.');
    return validatePluginFrameUrl(plugin.ui, window.location.origin, import.meta.env.DEV);
  }, [plugin.ui]);

  const childRoute = useMemo(() => {
    const prefix = normalizePluginRoutePrefix(plugin.ui!.route_prefix);
    const mount = `/orgs/${encodeURIComponent(orgId)}/${prefix}`;
    const pathname = location.pathname.startsWith(mount)
      ? location.pathname.slice(mount.length) || '/'
      : '/';
    return `${pathname}${location.search}`;
  }, [location.pathname, location.search, orgId, plugin.ui]);
  const childRouteRef = useRef(childRoute);
  const pluginRef = useRef(plugin);
  const themeRef = useRef(theme);
  childRouteRef.current = childRoute;
  pluginRef.current = plugin;
  themeRef.current = theme;

  const presentPluginDeploymentMaterial = useCallback((material: PluginDeploymentMaterial) => {
    if (material.kind === 'logs') {
      setVisibleLogs(material);
      return;
    }
    const url = URL.createObjectURL(new Blob([material.content], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `deployment-${material.deploymentId}-outputs.txt`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  useEffect(() => {
    portRef.current?.postMessage({
      type: 'stellwerk.host.route',
      sdk_version: pluginUiSdkVersion,
      nonce: nonceRef.current,
      route: childRoute,
    });
  }, [childRoute]);

  useEffect(() => {
    portRef.current?.postMessage({
      type: 'stellwerk.host.theme',
      sdk_version: pluginUiSdkVersion,
      nonce: nonceRef.current,
      theme,
    });
  }, [theme]);

  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (
        !frameWindow ||
        !isExpectedPluginReadyEvent(event, frameWindow, frameUrl.origin, nonceRef.current) ||
        portRef.current
      ) {
        return;
      }

      const channel = new MessageChannel();
      const currentPlugin = pluginRef.current;
      const currentOperations = bridgeOperationDescriptors(currentPlugin);
      clearInterval(handshakeTimerRef.current);
      handshakeTimerRef.current = undefined;
      portRef.current = channel.port1;
      channel.port1.onmessage = (portEvent: MessageEvent) => {
        const activePlugin = pluginRef.current;
        const session = { nonce: nonceRef.current, orgId, plugin: activePlugin };
        const validated = validatePluginBridgeRequest(portEvent.data, session);
        if (!validated.ok) {
          channel.port1.postMessage(
            bridgeError(validated.requestId, nonceRef.current, validated.error),
          );
          return;
        }
        if (validated.message.type === 'stellwerk.plugin.navigate') {
          navigate(pluginHostRoute(orgId, activePlugin.ui!.route_prefix, validated.message.route));
          return;
        }
        if (validated.message.type === 'stellwerk.plugin.navigate-core') {
          navigate(coreOrgRoute(orgId, validated.message.route));
          return;
        }

        const requestId = validated.message.request_id;
        if (!validated.invocation) {
          channel.port1.postMessage(
            bridgeError(requestId, nonceRef.current, 'The operation request is incomplete.'),
          );
          return;
        }
        const operation = bridgeOperationDescriptors(activePlugin).find(
          ({ id }) => id === validated.invocation?.operation_id,
        );
        if (!operation) {
          channel.port1.postMessage(
            bridgeError(requestId, nonceRef.current, 'The operation request is not registered.'),
          );
          return;
        }
        void invokeBridgeOperation(orgId, activePlugin.id, operation, validated.invocation, {
          presentPluginDeploymentMaterial,
        })
          .then((response) => {
            channel.port1.postMessage({
              type: 'stellwerk.host.operation.response',
              sdk_version: pluginUiSdkVersion,
              nonce: nonceRef.current,
              request_id: requestId,
              response,
            });
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'The plugin operation failed.';
            channel.port1.postMessage(bridgeError(requestId, nonceRef.current, message));
          });
      };
      channel.port1.start();
      frameWindow.postMessage(
        {
          type: 'stellwerk.host.init',
          sdk_version: pluginUiSdkVersion,
          nonce: nonceRef.current,
          org_id: orgId,
          plugin_id: currentPlugin.id,
          state: currentPlugin.state,
          mode: currentPlugin.mode,
          route: childRouteRef.current,
          theme: themeRef.current,
          locale: document.documentElement.lang || navigator.language,
          operations: currentOperations,
        },
        frameUrl.origin,
        [channel.port2],
      );
    };
    window.addEventListener('message', onReady);
    return () => {
      window.removeEventListener('message', onReady);
      clearInterval(handshakeTimerRef.current);
      handshakeTimerRef.current = undefined;
      portRef.current?.close();
      portRef.current = undefined;
    };
  }, [frameUrl.origin, navigate, orgId, plugin.id, presentPluginDeploymentMaterial]);

  const startHandshake = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;
    portRef.current?.close();
    portRef.current = undefined;
    clearInterval(handshakeTimerRef.current);
    nonceRef.current = crypto.randomUUID();
    setBridgeFailure(undefined);
    let attempts = 0;
    const sendHello = () => {
      attempts += 1;
      frameWindow.postMessage(
        {
          type: 'stellwerk.host.hello',
          sdk_version: pluginUiSdkVersion,
          nonce: nonceRef.current,
        },
        frameUrl.origin,
      );
    };
    sendHello();
    handshakeTimerRef.current = setInterval(() => {
      if (portRef.current) {
        clearInterval(handshakeTimerRef.current);
        handshakeTimerRef.current = undefined;
        return;
      }
      if (attempts >= 20) {
        clearInterval(handshakeTimerRef.current);
        handshakeTimerRef.current = undefined;
        setBridgeFailure('The plugin UI did not complete the bridge handshake.');
        return;
      }
      sendHello();
    }, 250);
  }, [frameUrl.origin]);
  const previousDescriptorRevision = useRef(descriptorRevision);

  useEffect(() => {
    if (descriptorRevision === previousDescriptorRevision.current) return;
    previousDescriptorRevision.current = descriptorRevision;
    startHandshake();
  }, [descriptorRevision, startHandshake]);

  if (bridgeFailure) {
    return (
      <Alert
        type={'error'}
        showIcon
        message={'Plugin UI bridge failed'}
        description={bridgeFailure}
      />
    );
  }
  if (plugin.mode === 'hidden') return null;
  if (!plugin.ui) return <Card loading />;

  return (
    <>
      <iframe
        ref={iframeRef}
        title={plugin.display_name}
        src={frameUrl.toString()}
        sandbox={'allow-scripts allow-forms allow-downloads allow-same-origin'}
        referrerPolicy={'no-referrer'}
        onLoad={startHandshake}
        onError={() => setBridgeFailure('The registered plugin UI could not be loaded.')}
        style={{ width: '100%', minHeight: 'calc(100vh - 160px)', border: 0 }}
      />
      <Modal
        open={Boolean(visibleLogs)}
        title={`Deployment ${visibleLogs?.deploymentId ?? ''} logs`}
        footer={null}
        width={'min(960px, 90vw)'}
        onCancel={() => setVisibleLogs(undefined)}
        destroyOnHidden>
        <Typography.Paragraph>
          <pre style={{ maxHeight: '65vh', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {visibleLogs?.content}
          </pre>
        </Typography.Paragraph>
      </Modal>
    </>
  );
};
