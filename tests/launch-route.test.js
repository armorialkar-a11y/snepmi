import test from 'node:test';
import assert from 'node:assert/strict';
import { launchRoute } from '../web/src/lib/launch-route.js';
test('primary and legacy launch buttons open home',()=>{assert.equal(launchRoute('home'),'/');assert.equal(launchRoute('catalog'),'/');});
test('explicit catalogue and admin deep links remain available',()=>{assert.equal(launchRoute('bloggers'),'/bloggers');assert.equal(launchRoute('admin'),'/admin');});
test('lead links still land on home and unknown params cannot redirect',()=>{assert.equal(launchRoute('form'),'/');assert.equal(launchRoute('lead'),'/');assert.equal(launchRoute(''),null);assert.equal(launchRoute('constructor'),null);assert.equal(launchRoute('https://evil.example'),null);});
