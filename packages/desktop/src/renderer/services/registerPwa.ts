/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isElectronDesktop } from '@renderer/utils/platform';

const SERVICE_WORKER_URL = './sw.js';
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalhost(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return LOCALHOST_HOSTS.has(window.location.hostname);
}

function isPwaRegistrationSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (isElectronDesktop() || !('serviceWorker' in navigator)) {
    return false;
  }

  const { protocol, hostname } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') {
    return false;
  }

  // LAN WebUI is a live app, not an offline/mobile PWA. Keeping a service
  // worker on iPad can replay stale bundles or force unexpected navigations.
  // Only keep PWA support for localhost development and HTTPS deployments.
  return protocol === 'https:' || LOCALHOST_HOSTS.has(hostname);
}

async function cleanupStalePwaState(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn('[PWA] Failed to unregister stale service workers:', error);
  }

  if (typeof caches === 'undefined') {
    return;
  }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.includes('aionui-webui')).map((key) => caches.delete(key)));
  } catch (error) {
    console.warn('[PWA] Failed to clear stale WebUI caches:', error);
  }
}

export async function registerPwa(): Promise<ServiceWorkerRegistration | undefined> {
  if (!isPwaRegistrationSupported()) {
    if (!isElectronDesktop() && !isLocalhost()) {
      await cleanupStalePwaState();
    }
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: './' });
    // Poll for updates on every page load so a fixed SW (e.g. v2 replacing
    // a poisoned v1 cache) reaches users without waiting for the browser's
    // own 24h update heuristic.
    registration.update().catch((): undefined => undefined);
    return registration;
  } catch (error) {
    console.warn('[PWA] Failed to register service worker:', error);
    return undefined;
  }
}

export default registerPwa;
