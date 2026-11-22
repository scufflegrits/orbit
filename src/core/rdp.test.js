// core/rdp.js: Remote Desktop hosts, .rdp profiles, preset settings, and the
// text and URLs a link launches with (tests/behavior-2.2.md, V05 and V08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { rdpHost, rdpText, runs } from '../../tests/unit/arbitraries.mjs';
import {
  RDP_FILE_LIMIT, decodeRdpBytes, effectiveRdpProfile, parseRdpProfile, presetSettings, rdpFileContent, rdpFileName,
  rdpLaunchUrl, validRdpHost,
} from './rdp.js';

const old = oracle();
const outcome = body => {
  try {
    return JSON.parse(JSON.stringify(body()));
  } catch (error) {
    return { error: error.message };
  }
};

test('hosts are trimmed by the caller; the port is normalized and must be 1-65535; case is kept', () => {
  assert.equal(validRdpHost('LAB1:03389', 'L'), 'LAB1:3389');
  assert.equal(validRdpHost('10.0.0.5', 'L'), '10.0.0.5');
  for (const bad of ['', 'lab1:0', 'lab1:65536', '-bad', 'a..b', 'x y', ' lab1', 'lab1:1:2']) {
    assert.throws(() => validRdpHost(bad, 'Planet 1'), { message: 'Planet 1 needs a computer name or IP address, with an optional port.' });
  }
});

test('a profile strips secrets silently and replaces the computer with the link\'s own', () => {
  const result = parseRdpProfile('﻿full address:s:old:3390\r\npassword 51:b:00\nscreen mode id:i:2\r\n\r\nusername:s:a', 'new');
  assert.deepEqual(result, {
    host: 'old:3390', removed: 1, settings: 3,
    content: 'full address:s:new\r\nscreen mode id:i:2\r\nusername:s:a\r\n',
  });
});

test('profile errors use 2.2.1\'s messages', () => {
  assert.throws(() => parseRdpProfile(null), { message: 'The .rdp file is not valid text.' });
  assert.throws(() => parseRdpProfile('a\0b'), { message: 'The .rdp file is not valid text.' });
  assert.throws(() => parseRdpProfile(''), { message: 'The .rdp file needs a full address setting.' });
  assert.throws(() => parseRdpProfile('full address:s:a\n   '), { message: 'The .rdp file has an invalid setting line.' });
  assert.throws(() => parseRdpProfile('full address:s:a\nfull address:s:b'), { message: 'The .rdp file has more than one computer address.' });
  assert.throws(() => parseRdpProfile('full address:i:1'), { message: 'The .rdp file has more than one computer address.' });
  assert.throws(() => parseRdpProfile(`full address:s:a\n${'x:s:' + 'y'.repeat(12000)}`), { message: 'The .rdp file is too large to launch through Orbit.' });
});

test('preset settings refuse secrets, skip blank lines, and drop the computer address', () => {
  assert.equal(presetSettings('full address:s:x\n  \nscreen mode id:i:2\r\n desktopwidth:i:1920 ', 'Wide'),
    'screen mode id:i:2\r\ndesktopwidth:i:1920');
  assert.throws(() => presetSettings('password 51:b:00', 'Wide'), { message: 'Wide cannot keep password 51; Orbit never stores credentials.' });
  assert.throws(() => presetSettings('nonsense', 'Wide'), { message: 'Wide has an invalid setting line: nonsense' });
  assert.throws(() => presetSettings(Array.from({ length: 101 }, (_, i) => `k${i}:i:1`).join('\n'), 'Wide'), { message: 'Wide has too many settings.' });
  assert.equal(presetSettings(undefined, 'Wide'), '');
});

const presets = [{ id: 'wide', name: 'Wide', settings: 'screen mode id:i:2' }, { id: 'none', name: 'None', settings: '' }];

test('a link opens with its preset (with its own computer), else its profile, else none', () => {
  assert.equal(effectiveRdpProfile({ name: 'L', type: 'rdp', host: 'lab1', rdpPreset: 'wide', rdpProfile: 'ignored' }, presets),
    'full address:s:lab1\r\nscreen mode id:i:2\r\n');
  assert.equal(effectiveRdpProfile({ name: 'L', type: 'rdp', host: 'lab1', rdpPreset: 'none' }, presets), 'full address:s:lab1\r\n');
  assert.equal(effectiveRdpProfile({ name: 'L', type: 'rdp', host: 'lab1', rdpPreset: 'gone', rdpProfile: 'p' }, presets), 'p');
  assert.equal(effectiveRdpProfile({ name: 'L', type: 'rdp', host: 'lab1' }, presets), null);
  assert.equal(effectiveRdpProfile({ name: 'L', type: 'rdp', host: 'lab1', rdpPreset: 'wide' }), null, 'no presets given');
});

test('the downloaded file falls back to asking for credentials', () => {
  assert.equal(rdpFileContent({ name: 'L', type: 'rdp', host: 'lab1' }, []), 'full address:s:lab1\r\nprompt for credentials:i:1\r\n');
  assert.equal(rdpFileContent({ name: 'L', type: 'rdp', host: 'lab1', rdpPreset: 'wide' }, presets), 'full address:s:lab1\r\nscreen mode id:i:2\r\n');
});

test('the downloaded file is named after the link', () => {
  assert.equal(rdpFileName({ name: 'Lab 1 (old)!' }), 'lab-1-old.rdp');
  assert.equal(rdpFileName({ name: '***' }), 'remote-desktop.rdp');
});

test('launch URLs carry the profile as unpadded base64url', () => {
  assert.equal(rdpLaunchUrl({ name: 'L', type: 'rdp', host: 'lab1:3390' }, []), 'orbit-rdp://lab1:3390/');
  assert.equal(rdpLaunchUrl({ name: 'L', type: 'rdp', host: 'h', rdpProfile: 'full address:s:h\r\n' }, []),
    'orbit-rdp://h/?profile=ZnVsbCBhZGRyZXNzOnM6aA0K');
});

test('.rdp bytes are read as UTF-8, or UTF-16 by byte-order mark or by their zero bytes', () => {
  const text = 'full address:s:lab1\r\n';
  const le = [...text].flatMap(ch => [ch.charCodeAt(0), 0]);
  const be = [...text].flatMap(ch => [0, ch.charCodeAt(0)]);
  assert.equal(decodeRdpBytes(new TextEncoder().encode(text)), text);
  assert.equal(decodeRdpBytes(new Uint8Array([0xff, 0xfe, ...le])), text);
  assert.equal(decodeRdpBytes(new Uint8Array(le)), text, 'UTF-16LE without a mark');
  assert.equal(decodeRdpBytes(new Uint8Array([0xfe, 0xff, ...be])), text);
  assert.throws(() => decodeRdpBytes(new Uint8Array([0xc3, 0x28])), TypeError, 'invalid UTF-8 is refused');
  assert.equal(RDP_FILE_LIMIT, 64000);
});

// Differential: the same answers or the same error messages as 2.2.1.
test('validRdpHost matches 2.2.1', () => {
  fc.assert(fc.property(rdpHost, host => {
    assert.deepEqual(outcome(() => validRdpHost(host, 'Planet 1')), old.call('validRdpHost', host, 'Planet 1'));
  }), runs(500));
});

test('parseRdpProfile matches 2.2.1', () => {
  fc.assert(fc.property(rdpText, fc.option(fc.constantFrom('lab9', 'LAB9:3390')), (text, target) => {
    assert.deepEqual(outcome(() => parseRdpProfile(text, target)), old.call('parseRdpProfile', text, target));
  }), runs(1000));
});

test('presetSettings matches 2.2.1', () => {
  fc.assert(fc.property(fc.oneof(rdpText, fc.constantFrom(undefined, null, 0, '')), text => {
    assert.deepEqual(outcome(() => presetSettings(text, 'Wide')), old.call('presetSettings', text, 'Wide'));
  }), runs(1000));
});

test('effectiveRdpProfile and rdpLaunchUrl match 2.2.1', () => {
  const sandbox = oracle();
  const link = fc.record({ name: fc.constant('L'), type: fc.constant('rdp'), host: fc.constantFrom('lab1', 'h:3390'),
    rdpPreset: fc.constantFrom(undefined, 'wide', 'none', 'gone'), rdpProfile: fc.constantFrom(undefined, 'full address:s:lab1\r\nx:i:1\r\n') },
  { requiredKeys: ['name', 'type', 'host'] });
  fc.assert(fc.property(link, fc.constantFrom([], presets), (item, list) => {
    sandbox.set('rdpPresets', list);
    assert.deepEqual(effectiveRdpProfile(item, list), sandbox.call('effectiveRdpProfile', item));
    assert.equal(rdpLaunchUrl(item, list), sandbox.call('rdpLaunchUrl', item));
  }), runs(300));
});
