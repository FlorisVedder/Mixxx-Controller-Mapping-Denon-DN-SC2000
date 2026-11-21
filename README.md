# Denon DN-SC-2000 — Mixxx controller mapping

A custom Mixxx controller mapping for the Denon DJ DN-SC-2000, written with  
the Components JS framework and JavaScript-side MIDI binding (`midiIn`/  
`midiOut`): the XML file registers the mapping and its settings, and every  
control binding lives in the script — no `<controls>` element. Written and  
wire-verified against Mixxx 2.6 (the XML declares `2.6+`).  
The mapping covers the whole controller and is under active development  
(see [Known issues](#known-issues-fixes-planned)).

## The controller

The DN-SC-2000 is a compact two-deck controller: one control surface — jog  
wheel, pitch fader, play/cue/sync/keylock, four cue pads, a loop section,  
an FX section with a dry/wet and three parameter knobs, a library section —  
that the hardware itself switches three ways:  

- **Deck layer** — the layer button lights blue or red and switches which  
  deck the surface controls, by MIDI channel.  
- **FX unit** — orange or green: switches which of the two FX units the  
  FX knobs drive, by control number.  
- **Cue-pad mode** — amber or green pads (toggled by SEL.): switches the  
  four pads between hotcues 1–4 and 5–8, by control number.  

## How the mapping treats the hardware

The mapping binds everything simultaneously: both layers' channels, both  
FX units' control numbers and both pad modes. The hardware switches (deck  
layer, FX unit, SEL.) are deliberately unbound — switching needs no script  
reaction and has no script side effects. The two switching axes are  
orthogonal: the deck layer selects the MIDI channel, the FX unit and the  
pad mode select control numbers; the GUI settings decide which Mixxx deck  
and FX unit each axis lands on (see below).  

## Hardware facts and conventions

Wire-verified against the unit with `--controller-debug`; this section is  
the evidence record the verification workflow in AGENTS.md refers to.  

### MIDI channels and the deck layer

- The hardware is set to a *pair* of MIDI channels: sets 1+2, 3+4, 5+6 or  
  7+8 (instructions on the rear of the unit: hold SHIFT and press BROWSE,  
  PREVIOUS, NEXT or DUPLICATE for sets 1-2, 3-4, 5-6 or 7-8). Layer A sends  
  on the first (odd) channel of the set, layer B on the second (even).  
- The mapping binds one channel set, matching the GUI's MIDI channel  
  setting; messages on the other sets are ignored.  
- Control numbers are identical across layers — only the status byte's  
  channel differs.  

### Buttons

Press = NOTE ON with value `0x40`, release = explicit NOTE OFF with value  
`0x00`; status bytes `0x90+ch` / `0x80+ch`. The hardware is stateless per  
press — every press of a control sends the identical pair, so on/off  
toggling lives in the mapping, not in the hardware.

### Relative encoders

One CONTROL_CHANGE (`0xB0+ch`) per tick, with direction values **CCW =  
`0x7F`, CW = `0x00`** — inverted versus the common convention (verify, never  
assume). All turning knobs on this controller are detented.

### Jog wheel

Rotation and touch share one control number (`0x51`), multiplexed by the  
status byte alone:  

- Rotation: CONTROL_CHANGE with `0x40`-centered, speed-scaled values; the  
  message rate scales with speed too.  
- Touch: the standard NOTE pair, one pair per touch.  

The wheel is a 2048-pulse-per-cycle encoder (official spec). Touch  
transmission is hardware-gated: vinyl mode always transmits the touch; bend  
mode transmits it only while the deck is not playing — on a playing deck,  
no touch pair arrives at all. Whether the mapping scratches or bends is  
software-side (`vinylMode`); the touch gate makes the mode behave  
appropriately for free.

### Pitch fader

The fader sends true 14-bit MIDI pitch-bend messages (status `0xE0+ch`, the  
only control with no control-number byte): bottom `0x0000`, center of  
travel `0x2000`, top `0x3FFF`.

### LED outputs

LEDs are CC messages with **swapped byte roles**: byte 1 carries the LED  
state (`LED_ON 0x4A`, `LED_OFF 0x4B`, `LED_FLASH 0x4C`), byte 2 carries the  
LED number. Colors are hardware-driven — layer blue/red, FX unit orange/  
green, pad mode amber/green — the software controls only on/off (/flash).  
The hardware filters LED output by the active layer's channel: per-layer  
redundant output is safe, the inactive layer's lines are inert. The  
hardware supports flashing (`0x4C`); the mapping deliberately uses it  
sparingly — the blinking that matters (cue/play while a track is loaded but  
not playing) is software-driven via Mixxx's indicator COs.

### Control numbers

Script keys are the entries of the script's `controlList` (inputs) and  
`ledList` (outputs); callout numbers in parentheses follow the official  
function tables. The two unbound hardware switches are included for  
completeness.

Buttons (all share the NOTE pair convention above):

| Control                              | Script key        | Ctrl   |
|--------------------------------------|-------------------|--------|
| DRY/WET push, FX unit 1 (#3, orange) | `dryWetClick` [0] | `0x15` |
| DRY/WET push, FX unit 2 (#3, green)  | `dryWetClick` [1] | `0x55` |
| PARAM.1 push, FX unit 1 (#4, orange) | `param1Click` [0] | `0x12` |
| PARAM.1 push, FX unit 2 (#4, green)  | `param1Click` [1] | `0x52` |
| PARAM.2 push, FX unit 1 (#5, orange) | `param2Click` [0] | `0x13` |
| PARAM.2 push, FX unit 2 (#5, green)  | `param2Click` [1] | `0x53` |
| PARAM.3 push, FX unit 1 (#6, orange) | `param3Click` [0] | `0x14` |
| PARAM.3 push, FX unit 2 (#6, green)  | `param3Click` [1] | `0x54` |
| FX on/off, FX unit 1 (#13, orange)   | `fx` [0]          | `0x56` |
| FX on/off, FX unit 2 (#13, green)    | `fx` [1]          | `0x57` |
| FILTER knob push (#7)                | `filterClick`     | `0x68` |
| TRACK SELECT knob push (#1)          | `browseClick`     | `0x28` |
| CUE pad 1, hotcue mode (#21, amber)  | `hotCue1`         | `0x17` |
| CUE pad 2, hotcue mode (#21, amber)  | `hotCue2`         | `0x18` |
| CUE pad 3, hotcue mode (#21, amber)  | `hotCue3`         | `0x19` |
| CUE pad 4, hotcue mode (#21, amber)  | `hotCue4`         | `0x20` |
| CUE pad 1, sampler mode (#21, green) | `hotCue5`         | `0x21` |
| CUE pad 2, sampler mode (#21, green) | `hotCue6`         | `0x22` |
| CUE pad 3, sampler mode (#21, green) | `hotCue7`         | `0x23` |
| CUE pad 4, sampler mode (#21, green) | `hotCue8`         | `0x24` |
| SEL. button (#22)                    | `hotCueSelect`    | `0x1A` |
| SHIFT button (#23)                   | `shift`           | `0x60` |
| CUE button (#26)                     | `cue`             | `0x42` |
| PLAY/PAUSE button (#27)              | `play`            | `0x43` |
| SYNC button (#14)                    | `sync`            | `0x6B` |
| KEYLOCK button (#15)                 | `keyLock`         | `0x06` |
| LOOP IN button (VDJ #12)             | `loopIn`          | `0x37` |
| LOOP OUT button (VDJ #13)            | `loopOut`         | `0x39` |
| BEAT - button (VDJ #14)              | `minus`           | `0x69` |
| AUTO LOOP button (VDJ #15)           | `autoLoop`        | `0x1D` |
| BEAT + button (VDJ #16)              | `plus`            | `0x6A` |
| PITCH BEND, slower (#16)             | `pitchBendDown`   | `0x0D` |
| PITCH BEND, faster (#16)             | `pitchBendUp`     | `0x0C` |
| FAST SEARCH, right/forward (#25)     | `forward`         | `0x10` |
| FAST SEARCH, left/backward (#25)     | `backward`        | `0x11` |
| BROWSER (#9)                         | `browse`          | `0x64` |
| PREVIOUS (#10)                       | `previous`        | `0x30` |
| NEXT (#11)                           | `next`            | `0x29` |
| DUPLICATE (#12)                      | `duplicate`       | `0x65` |
| Deck layer button (hardware switch)  | `deckChg`         | `0x03` |
| FX unit button (hardware switch)     | `fxUnitSelector`  | `0x58` |

Relative encoders (all share the CC/direction convention above):

| Control                              | Script key       | Ctrl   |
|--------------------------------------|------------------|--------|
| DRY/WET turn, FX unit 1 (#3, orange) | `dryWetTurn` [0] | `0x55` |
| DRY/WET turn, FX unit 2 (#3, green)  | `dryWetTurn` [1] | `0x59` |
| PARAM.1 turn, FX unit 1 (#4, orange) | `param1Turn` [0] | `0x56` |
| PARAM.1 turn, FX unit 2 (#4, green)  | `param1Turn` [1] | `0x5A` |
| PARAM.2 turn, FX unit 1 (#5, orange) | `param2Turn` [0] | `0x57` |
| PARAM.2 turn, FX unit 2 (#5, green)  | `param2Turn` [1] | `0x5B` |
| PARAM.3 turn, FX unit 1 (#6, orange) | `param3Turn` [0] | `0x58` |
| PARAM.3 turn, FX unit 2 (#6, green)  | `param3Turn` [1] | `0x5C` |
| TRACK SELECT knob turn (#1)          | `browseTurn`     | `0x54` |
| FILTER knob turn (#7)                | `filterTurn`     | `0x5D` |

LEDs (all share the swapped-roles convention above):

| Control                              | Script key   | LED number |
|--------------------------------------|--------------|------------|
| DRY/WET ring, FX unit 1 (#3, orange) | `dryWet` [0] | `0x5C`     |
| DRY/WET ring, FX unit 2 (#3, green)  | `dryWet` [1] | `0x60`     |
| PARAM.1 ring, FX unit 1 (#4, orange) | `param1` [0] | `0x5D`     |
| PARAM.1 ring, FX unit 2 (#4, green)  | `param1` [1] | `0x61`     |
| PARAM.2 ring, FX unit 1 (#5, orange) | `param2` [0] | `0x5E`     |
| PARAM.2 ring, FX unit 2 (#5, green)  | `param2` [1] | `0x62`     |
| PARAM.3 ring, FX unit 1 (#6, orange) | `param3` [0] | `0x5F`     |
| PARAM.3 ring, FX unit 2 (#6, green)  | `param3` [1] | `0x63`     |
| CUE pad 1 LED, hotcue (#21, amber)   | `hotCue1`    | `0x11`     |
| CUE pad 2 LED, hotcue (#21, amber)   | `hotCue2`    | `0x13`     |
| CUE pad 3 LED, hotcue (#21, amber)   | `hotCue3`    | `0x15`     |
| CUE pad 4 LED, hotcue (#21, amber)   | `hotCue4`    | `0x17`     |
| CUE pad 1 LED, sampler (#21, green)  | `hotCue5`    | `0x19`     |
| CUE pad 2 LED, sampler (#21, green)  | `hotCue6`    | `0x1B`     |
| CUE pad 3 LED, sampler (#21, green)  | `hotCue7`    | `0x1D`     |
| CUE pad 4 LED, sampler (#21, green)  | `hotCue8`    | `0x20`     |
| CUE button LED (#26)                 | `cue`        | `0x26`     |
| PLAY button LED (#27)                | `play`       | `0x27`     |
| SYNC button LED (#14)                | `sync`       | `0x09`     |
| KEYLOCK button LED (#15)             | `keyLock`    | `0x08`     |
| LOOP IN button LED (VDJ #12)         | `loopIn`     | `0x24`     |
| LOOP OUT button LED (VDJ #13)        | `loopOut`    | `0x40`     |
| AUTO LOOP button LED (VDJ #15)       | `autoLoop`   | `0x2B`     |
| FX on/off, FX unit 1 (#13, orange)   | `fx` [0]     | `0x5A`     |
| FX on/off, FX unit 2 (#13, green)    | `fx` [1]     | `0x5B`     |
## Controls reference

What each control does in Mixxx. The Mixxx control names are in the  
script (`AGENTS.md` documents how it is structured).  

### Deck controls (per layer)

| Control                         | Function                                                            | With SHIFT                                 |
|---------------------------------|---------------------------------------------------------------------|--------------------------------------------|
| PLAY/PAUSE                      | play/pause (LED blinks while a track is loaded but paused)          | —                                          |
| CUE                             | cue                                                                 | —                                          |
| SYNC                            | tap: one-shot sync (LED flashes once); hold: sync lock (LED steady) | —                                          |
| KEYLOCK                         | keylock on/off                                                      | toggle quantize                            |
| PITCH BEND slower / faster      | temporary tempo change                                              | smaller tempo change                       |
| PITCH FADER                     | tempo (see known issues)                                            | —                                          |
| JOG wheel                       | vinyl mode: scratch; bend mode: pitch bend                          | —                                          |
| CUE pads, amber mode            | hotcues 1–4                                                         | clear the hotcue                           |
| CUE pads, green mode            | hotcues 5–8                                                         | clear the hotcue                           |
| LOOP IN                         | set the loop start                                                  | jump to the loop start                     |
| LOOP OUT                        | set the loop end                                                    | jump to the loop end                       |
| AUTO LOOP                       | activate a beatloop (LED mirrors the loop state)                    | reloop toggle                              |
| BEAT − / BEAT +                 | beat jump backward / forward                                        | —                                          |
| FILTER knob, turn               | loop size: ×2 per right click, ÷2 per left                          | beat-jump size                             |
| FILTER knob, push               | loop anchor on/off                                                  | align the beatgrid to the current position |
| FX on/off buttons (per FX unit) | enable that FX unit for this layer's deck                           | —                                          |

### FX section (per unit; two units per layer)

| Control               | Function                                          | With SHIFT                                              |
|-----------------------|---------------------------------------------------|---------------------------------------------------------|
| DRY/WET knob, turn    | the unit's mix amount                             | cycle the unit's chain preset                           |
| DRY/WET knob, push    | route the unit to the headphone output (ring LED) | switch the unit's mix mode (crossed dry/wet vs dry+wet) |
| PARAM 1–3 knobs, turn | the parameter (meta) of effect slot 1–3           | select a different effect for that slot                 |
| PARAM 1–3 knobs, push | enable/disable that effect slot (ring LED)        | —                                                       |
| FX unit button        | hardware switch — unbound                         | —                                                       |

### Library controls (per layer; loading goes to the layer's deck)

| Control                 | Function                                                        | With SHIFT              |
|-------------------------|-----------------------------------------------------------------|-------------------------|
| TRACK SELECT knob, turn | move through the track list                                     | move across the columns |
| TRACK SELECT knob, push | open the selected item / load the selected track                | sort the focused column |
| BROWSER                 | clear the search field                                          | —                       |
| PREVIOUS / NEXT         | move the library focus backward / forward                       | —                       |
| DUPLICATE               | clone the other layer's track into this deck (see known issues) | —                       |
| SEL.                    | hardware pad-mode switch — unbound                              | —                       |
| Layer button            | hardware deck-layer switch — unbound                            | —                       |
| SHIFT                   | shifts every component on both layers; no LED of its own        | —                       |

## Settings (Mixxx GUI)

Preferences → Controllers → the DN-SC-2000. Anything the hardware  
configures or a user would want to choose is a setting, not a hardcoded  
constant — settings are per controller, so several DN-SC-2000 units keep  
independent configurations.  

| Setting                    | Values (default)            | Meaning                                                              |
|----------------------------|-----------------------------|----------------------------------------------------------------------|
| MIDI channel               | 1 and 2 … 7 and 8 (1 and 2) | the channel pair set on the hardware (rear of the unit) — must match |
| Deck A: Blue               | deck 1–4 (1)                | Mixxx deck the blue layer controls                                   |
| Deck B: Red                | deck 1–4 (2)                | Mixxx deck the red layer controls                                    |
| Deck A: Blue [FX1] / [FX2] | FX unit 1–4 (1 / 2)         | Mixxx FX units the blue layer's two hardware FX units drive          |
| Deck B: Red [FX1] / [FX2]  | FX unit 1–4 (1 / 2)         | same, for the red layer                                              |

## Installation

**1. Requirements.** Mixxx 2.6 or later.  

**2. Fetch the components library.** The mapping needs a custom copy of  
the Components JS library: the stock `midi-components-0.0.js` extended  
with JavaScript-side midiIn/midiOut registration  
([PR #15491](https://github.com/mixxxdj/mixxx/pull/15491), open upstream —  
until it ships in Mixxx, the library is fetched from the PR branch). It is  
deliberately not shipped in this repository — one authoritative source, no  
per-repo drift. Fetch it next to the mapping files, under the name the XML  
loads:  

```sh
curl -L -o midi-components-0-inout.js \
    https://raw.githubusercontent.com/FlorisVedder/mixxx-midiInput/support-dynamic-binding-components/res/controllers/midi-components-0.0.js
```

The `inout` qualifier marks what the fork adds — JavaScript-side  
`midiIn`/`midiOut` registration — and keeps the name distinct from the  
stock `midi-components-0.0.js` that Mixxx itself ships.  

**Keep the copy current.** `midi-components-0-inout.js` must always be a  
verbatim copy of the most recent `res/controllers/midi-components-0.0.js`  
from the PR's head branch (`FlorisVedder/mixxx-midiInput`, branch  
`support-dynamic-binding-components` — the URL above). The file is  
gitignored: never edit it and never commit it; when the PR updates,  
re-run the command and replace the local copy.  

**3. Copy the files** into the user presets folder — Preferences →  
Controllers → *Open User Preset Folder*, or directly: Linux  
`~/.mixxx/controllers`, Windows `%LOCALAPPDATA%\Mixxx\controllers`, macOS  
`~/Library/Containers/org.mixxx.mixxx/Data/Library/Application Support/Mixxx/`  
`controllers`. Files: `Denon-SC2000.midi.xml`, `Denon-SC2000-scripts.js`,  
`midi-components-0-inout.js`.  

**4. Load the mapping.** Restart Mixxx, then Preferences → Controllers →  
the DN-SC-2000 → load the *Denon DN-SC2000 FV* preset. The preset's  
internal id still carries a development leftover (see Known issues), so  
load it manually rather than relying on auto-detection.  

**5. Configure.** Set the MIDI channel setting to the channel pair the  
hardware is set to, and assign decks and FX units to the layers.  

## Development

- [AGENTS.md](AGENTS.md) in the repository root is the standard this  
  mapping follows: project structure, code style and the verification  
  workflow.  
- The repository carries npm tooling: `package.json` with ESLint 10 and a  
  flat `eslint.config.js` covering the mapping script (Mixxx QJSEngine  
  scope with the VM globals declared) and the Node tools (`npm ci` to  
  install, `npm run lint` to lint).  
- `tools/dump-bindings.js` snapshots every resolved MIDI binding;  
  `tools/dn-bindings-baseline.txt` is the committed baseline. After any  
  change, run  
  `node tools/dump-bindings.js --compare tools/dn-bindings-baseline.txt`:  
  exit 0 means the resolved bindings are unchanged (wire-neutral), exit 1  
  means they differ, which is acceptable only in a deliberate  
  behavior-fix commit (regenerate the baseline in that same commit).  
- Binding changes are verified on the hardware with `--controller-debug`;  
  the observed wire facts live in the hardware section above and are kept  
  in sync with the mapping.  

## Known issues (fixes planned)

- **Cue-pad LED blink** — every pad activation briefly blinks the pad LED  
  dark (the LED scale maps only one of the three hotcue states to on).  
- **SHIFT+KEYLOCK LED burst** — each shift cycle leaks one output  
  connection, so SHIFT+KEYLOCK (and plain KEYLOCK toggles afterwards) send  
  bursts of duplicate LED lines; the toggling itself is unaffected.  
- **Pitch fader granularity** — the input binding fires only in narrow  
  bands across the fader's 14-bit range, so the tempo follows the fader in  
  steps; slow adjustments are fine, fast sweeps are coarse.  
- **Scratch speed** — the scratch resolution is set ~7% too high (2200 vs  
  the official 2048 pulses per cycle); scratching runs slightly slower  
  than the physical wheel motion.  
- **LOOP IN / LOOP OUT LEDs** — never light (the components declare an LED  
  but no output key).  
- **DUPLICATE inconsistency** — the blue layer's DUPLICATE acts on release,  
  the red layer's on press.  
- **Preset id leftover** — the XML declares `<controller id="AMXFV">`, a  
  copy-paste leftover from the Akai AMX mapping; unknown whether it  
  affects auto-recognition — hence the manual load.  
- **Shift registration asymmetry** (latent, no visible effect) — the  
  all-layer shift broadcast relies on the shift buttons sharing one  
  subscriber collection.  

## Links and license

- [AGENTS.md](AGENTS.md) — the mapping standard.  
- Sibling mappings: [Akai AMX](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Akai-AMX)  
  · [Vestax VCI-400](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Vestax-VCI400)  

- [Mixxx 2.6 manual](https://manual.mixxx.org/2.6/en/) ·  
  [Mixxx Controls reference](https://manual.mixxx.org/2.6/en/chapters/appendix/mixxx_controls.html)  
- [Components JS wiki](https://github.com/mixxxdj/mixxx/wiki/Components-JS) ·  
  [MIDI scripting wiki](https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting)  

License: GPL-3.0-or-later (see `package.json`).  
