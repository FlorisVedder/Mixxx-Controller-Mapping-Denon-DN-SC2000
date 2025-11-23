/**
 * Required controller object for Mixxx.
 *
 * Connected by the functionprefix attribute in the midi.xml file.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
var DnSc2000 = {};


const SWITCH_ON = 0x01;
const VALUE_ON = 0X40;
// const VALUE_OFF = 0X00;
const ENCODER_LEFT = 0X7F;
const ENCODER_RIGHT = 0X00;
const LED_ON = 0x4A;
const LED_OFF = 0x4B;
const LED_FLASH = 0x4C;

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*      Central object that describes the controller hardware       *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

DnSc2000.Hardware = function (midiChannel, groupNumber) {
    this.midiChannel = midiChannel;
    this.groupNumber = groupNumber;

    this.controlList = {};
    this.ledList = {};

    const NOTE_ON = 0x90;
    const NOTE_OFF = 0x80;
    const CONTROL_CHANGE= 0xB0;
    const PITCH_STATUS = 0xE0;

    this.getGroupNumber = function () {
        return this.groupNumber;
    };

    this.getNoteOn = function () {
        return NOTE_ON + this.midiChannel;
    };

    this.getNoteOff = function () {
        return NOTE_OFF + this.midiChannel;
    };

    this.getControlChange = function () {
        return CONTROL_CHANGE + this.midiChannel;
    };

    this.getPitchStatus = function () {
        return PITCH_STATUS + this.midiChannel;
    };

    this.getControl = function (controlName) {
        return this.controlList[controlName];
    };

    this.getLed = function (ledName) {
        return this.ledList[ledName];
    }
};

/**
 * Hardware information.
 *
 * All controls and leds except the fx section.
 */
DnSc2000.DeckHardware = function (midiChannel, groupNumber) {
    this.prototype = DnSc2000.Hardware;
    this.prototype.call(this, midiChannel, groupNumber);
    this.controlList = {
        // selectors
        'fxUnitSelector': 0x58,
        'deckChg': 0x03,
        // library
        'browse': 0x64,
        'previous': 0x30,
        'browseTurn': 0x54,
        'browseClick': 0x28,
        'next': 0x29,
        'duplicate': 0x65,
        // loop
        'loopIn': 0x37,
        'loopOut': 0x39,
        'loopHalf': 0x69,
        'loopDouble': 0x6A,
        'autoLoop': 0x1D,
        'filterRotate': 0x5D,
        'filterClick': 0x68,
        // hot-cues
        'hotCue1': 0x17,
        'hotCue2': 0x18,
        'hotCue3': 0x19,
        'hotCue4': 0x20,
        'hotCue5': 0x21,
        'hotCue6': 0x22,
        'hotCue7': 0x23,
        'hotCue8': 0x24,
        'hotCueSelect': 0x1A,
        'shift': 0x60,
        // transport
        'backward': 0x11,
        'forward': 0x10,
        'cue': 0x42,
        'play': 0x43,
        'jogwheel': 0x51,
        // fx
        'fx1': 0x56,
        'fx2': 0x57,
        // settings
        'keyLock': 0x06,
        'sync': 0x6B,
        // pitch
        'pitchBendDown': 0x0D,
        'pitchBendUp': 0x0C,
        'pitch': 0x5F,
    };

    this.ledList = {
        'keyLock': 0x08,
        'sync': 0x09,
        'hotCue1': 0x11,
        'hotCue2': 0x13,
        'hotCue3': 0x15,
        'hotCue4': 0x17,
        'hotCue5': 0x19,
        'hotCue6': 0x1B,
        'hotCue7': 0x1D,
        'hotCue8': 0x20,
        'cue': 0x26,
        'play': 0x27,
    }
};


/**
 * Effect hardware.
 *
 * Separate effects hardware due to the differentiation with decks.
 *
 * The difference between Deck A and Deck B is based upon the midi channel.
 * But within that channel only one control number per element.
 *
 * The difference between FX unit is based upon the control numbers.
 * This means that Deck A (on midi channel zero) can have two separate FX units
 * from Deck B (on midi channel one) and both having two units. So that's a total
 * of 4 FX units.
 */
DnSc2000.EffectsHardware = function (midiChannel, groupNumber, index) {
    this.prototype = DnSc2000.Hardware.prototype;
    this.prototype.call(this, midiChannel, groupNumber);
    this.index = index;

    this.layout = {
        'dryWetTurn': [0x55, 0x59],
        'param1Turn': [0x56, 0x5A],
        'param2Turn': [0x57, 0xAB],
        'param3Turn': [0x58, 0xAC],
        'dryWetClick': [0x15, 0x55],
        'param1Click': [0x12, 0x52],
        'param2Click': [0x13, 0x53],
        'param3Click': [0x14, 0x54],
    };

    this.getIndex = function () {
        return this.index;
    };

    this.getControl = function(controlName) {
        return this.layout[controlName][index];
    }
};



////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*                Required  Mixxx javascript methods                *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Required Mixxx init function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
DnSc2000.init = function () {
    let midiChannelDeckA = 0;
    let midiChannelDeckB = midiChannelDeckA + 1;
    let hardwareDeckA = new DnSc2000.DeckHardware(midiChannelDeckA, 1);
    let hardwareDeckB = new DnSc2000.DeckHardware(midiChannelDeckB, 2);

    this.globalA = new DnSc2000.Global(hardwareDeckA);
    this.globalB = new DnSc2000.Global(hardwareDeckB);

    this.libraryA = new DnSc2000.Library(hardwareDeckA);
    this.libraryB = new DnSc2000.Library(hardwareDeckB);

    this.deckA = new DnSc2000.Deck(hardwareDeckA);
    this.deckB = new DnSc2000.Deck(hardwareDeckB);

    this.globalA.shiftButton.registerComponent(this.libraryA);
    this.globalB.shiftButton.registerComponent(this.libraryB);
    this.globalB.shiftButton.registerComponent(this.deckA);
    this.globalB.shiftButton.registerComponent(this.deckB);
};

/**
 * Required Mixxx shutdown function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
DnSc2000.shutdown = function () {
    this.libraryA.shutdown();
    this.libraryB.shutdown();
    this.deckA.shutdown();
    this.deckB.shutdown();
};

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*  Components JS implementation for a Global and Master container  *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////


DnSc2000.Global = function(hardware) {

    this.shiftButton = new DnSc2000.ShiftButton({
        midiIn: [[hardware.getNoteOn(), hardware.getControl('shift')], [hardware.getNoteOff(), hardware.getControl('shift')]],
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = "[Global]";
        }
    });

};
DnSc2000.Global.prototype = new components.ComponentContainer();


/**
 * Constructor for the library group controls in mixxx.
 */
DnSc2000.Library = function(hardware) {
    const NOTE_ON = hardware.getNoteOn();

    this.browse = new components.Encoder({
        midiIn: [hardware.getControlChange(), hardware.getControl('browseTurn')],
        input: function (channel, control, value) {
            if (value === ENCODER_RIGHT) {
                this.inSetParameter(1);
            } else if (value === ENCODER_LEFT) {
                this.inSetParameter(- 1);
            }
        },
        unshift: function() {
            this.inKey = "MoveVertical";
        },
        shift: function() {
            this.inKey = "MoveHorizontal";
        }
    });

    this.browseClick = new components.Button({
        midiIn: [NOTE_ON, hardware.getControl('browseClick')],
        unshift: function() {
            this.inKey = "GoToItem";
        },
        shift: function() {
            this.inKey = "sort_focused_column";
        },
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = "[Library]";
        }
    });
};
DnSc2000.Library.prototype = new components.ComponentContainer();


////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*            Components JS implementations for Deck's              *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Constructor for the deck functionality.
 */
DnSc2000.Deck = function (hardware) {
    components.Deck.call(this, hardware.getGroupNumber());
    const NOTE_ON = hardware.getNoteOn();
    const NOTE_OFF = hardware.getNoteOff();
    const CONTROL_CHANGE = hardware.getControlChange();
    const JOGWHEEL_CENTER = 0X40

    this.syncButton = new components.SyncButton({
        midiIn: [[NOTE_ON, hardware.getControl('sync')], [NOTE_OFF, hardware.getControl('sync')]],
        midiOut: [CONTROL_CHANGE, LED_ON],
        led: hardware.getLed('sync'),
        outValueScale: DnSc2000.replacements.ledOutValueScale,
    });

    this.keyLock = new components.Button({
        midiIn: [[NOTE_ON, hardware.getControl('keyLock')], [NOTE_OFF, hardware.getControl('keyLock')]],
        midiOut: [CONTROL_CHANGE, LED_ON],
        unshift: function() {
            this.inKey = 'keylock';
            this.outKey = 'keylock';
            this.connectMidiOut();
            this.trigger();
        },
        shift: function() {
            this.inKey = 'quantize';
            this.outKey = 'quantize';
            this.connectMidiOut();
            this.trigger();
        },
        led: hardware.getLed('keyLock'),
        outValueScale: DnSc2000.replacements.ledOutValueScale,
        type: components.Button.prototype.types.toggle,
    });

    this.pitchBendDown = new components.Button({
        midiIn: [[NOTE_ON, hardware.getControl('pitchBendDown')], [NOTE_OFF, hardware.getControl('pitchBendDown')]],
        unshift: function() {
            this.inKey = "rate_temp_down";
        },
        shift: function() {
            this.inKey = "rate_temp_down_small";
        }
    });
    this['pitchBendUp'] = new components.Button({
        midiIn: [[NOTE_ON, hardware.getControl('pitchBendUp')], [NOTE_OFF, hardware.getControl('pitchBendUp')]],
        unshift: function() {
            this.inKey = "rate_temp_up";
        },
        shift: function() {
            this.inKey = "rate_temp_up_small";
        }
    });

    for (let i =1; i <= 8; i++) {
        this['hotCue' + i] = new components.HotcueButton({
            midiIn: [[NOTE_ON, hardware.getControl('hotCue' + i)], [NOTE_OFF, hardware.getControl('hotCue' + i)]],
            midiOut: [CONTROL_CHANGE, LED_ON],
            number: i,
            led: hardware.getLed('hotCue' + i),
            outValueScale: DnSc2000.replacements.ledOutValueScale,
        });
    }

    this.jogWheel = new components.JogWheelBasic({
        deck: hardware.getGroupNumber(),
        wheelResolution: 2200,
        alpha: 1/8,
        group: "[Channel" + hardware.getGroupNumber() + "]",
        inValueScale: function (value) {
            let factor = 0.2;
            if (engine.isScratching(this.deck)) {
                factor = 1;
            }
            return (value - JOGWHEEL_CENTER) * factor;
        },
    });

    this.backward = new components.Button({
        midiIn: [[NOTE_ON, hardware.getControl('backward')], [NOTE_OFF, hardware.getControl('backward')]],
        unshift: function() {
            this.inKey = 'back';
        },
        shift: function() {
            this.inKey = 'beat_distance'; // just a readout key to prevent action because the shift state is dedicated to hardware vinyl select.
        }
    });
    this.forward = new components.Button({
        midiIn: [[NOTE_ON, hardware.getControl('forward')], [NOTE_OFF, hardware.getControl('forward')]],
        unshift: function() {
            this.inKey = 'fwd';
        },
        shift: function() {
            this.inKey = 'beat_distance'; // just a readout key to prevent action because the shift state is dedicated to hardware bend select.
        }
    });

    this.cueButton = new components.CueButton({
        midiIn: [[NOTE_ON, hardware.getControl('cue')], [NOTE_OFF, hardware.getControl('cue')]],
        midiOut: [CONTROL_CHANGE, LED_ON],
        led: hardware.getLed('cue'),
        outValueScale: DnSc2000.replacements.ledOutValueScale,
    });

    this.playButton = new components.PlayButton({
        midiIn: [[NOTE_ON, hardware.getControl('play')], [NOTE_OFF, hardware.getControl('play')]],
        midiOut: [CONTROL_CHANGE, LED_ON],
        led: hardware.getLed('play'),
        outValueScale: DnSc2000.replacements.ledOutValueScale,
    });

    // Connect all components of this deck to the same control group.
    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};
DnSc2000.Deck.prototype = new components.Deck([]);

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*                  Components replacements                         *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

DnSc2000.replacements = {

    /**
     * Custom out value scale for buttons to light up leds.
     *
     * In contrast to other controllers the midiSendShortMsg works slightly different.
     * sendShortMsg(status, byte1, byte2)
     * - byte1 is the LED status value (on or off)
     * - byte2 is the number for the LED to light up
     * Therefore:
     * this.midiOut[0][1] is set to that on or of value.
     * this.led is the return value for this function
     */
    ledOutValueScale: function (value) {
        if (
            !'led' in this
            || typeof this.midiOut !== 'object'
            || typeof this.midiOut[0] === 'undefined'
        ) {
            return components.Button.prototype.outValueScale.call(this, value);
        }
        if (value === 1) {
            this.midiOut[0][1] = LED_ON;
        } else {
            this.midiOut[0][1] = LED_OFF;
        }
        return this.led;
    },
}

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*                      Custom components                           *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Shift Button
 *
 * Observer Subject where every component or collection of components
 * (component container) can subscribe to. This observer subject
 * notifies its subscribers by calling the shift and unshift methods.
 *
 * At initialisation create an object e.g.
 * MyController.shiftButton = new DnSc2000.ShiftButton();
 *
 * Then register a separate component like a button or a
 * component container with multiple components, like a deck.
 * MyController.shiftButton->registerComponentContainer(MyController.Deck)
 *
 * @param options array
 * Midi components options array, see midi-components-0.0.js
 */
DnSc2000.ShiftButton = (function() {

    let componentCollection = [];
    function ShiftButton(options) {
        components.Button.call(this, options);

        this.registerComponent = function (component) {
            if (component instanceof components.Component || component instanceof components.ComponentContainer) {
                componentCollection.push(component);
            }
        };

        this.input = function (channel, control, value) {
            this.action = 'unshift';
            if (value === VALUE_ON) {
                this.action = 'shift';
            }
            notifySubscribers(this.action, componentCollection);
        };
    }

    function notifySubscribers(action, subscribers) {
        subscribers.forEach(function (component) {
            component[action]();
        });
    }

    ShiftButton.prototype = Object.create(components.Button.prototype);
    return ShiftButton;
}());
