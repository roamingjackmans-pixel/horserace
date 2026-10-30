# 🏇 Horse Race

A silly online horse racing party game for the browser. Make a lobby, share the 5-number code, bet chips on
ridiculous horses, and dish out penalties to your friends when you win.

**Play:** https://josephjackman.com/horserace/

## The rules

- One person **makes a lobby** and shares its **5-number code** (or the invite link, `?room=CODE`).
- Every race, **4 to 6 horses** show up, each with one of **200 funny names**.
- Each player **picks a horse and bets 1 to 20 chips**. Several people can back the same horse, but only the
  **first person to pick it can rename it**.
- The track has **20 evenly spaced gates** by default (the last gate is the finish line). The host can set it
  anywhere from **3 to 100 gates** between races, with presets for Quick (7), Classic (20), Long (50) and
  Marathon (100).
- Horses don't run smoothly: each one waits a random 0.3–1.3 seconds, then **hops forward exactly one gate**
  in a quick leap. Every horse has the same odds (no hidden speed), so a horse way out in front can still be
  caught: on 20 gates, a horse leading by 2+ gates at the three-quarter mark still loses about a quarter of
  the time.
- Every time **all** the horses make it through the next gate for the first time, every horse stops for a
  moment: **one horse is boosted forward one gate and a different one is set back one gate**.
- No horse gets more boosts, or more setbacks, than **30% of the gates, rounded up**: 3 each on 7 gates, 6 on
  20, 30 on 100.
- Rough race lengths: 7 gates about 12 seconds, 20 gates about 50 seconds, 50 gates about 2⅓ minutes,
  100 gates about 5 minutes (plus a 4-second countdown).
- If your horse wins, you **win the chips you bet**, and you get **twice your bet in penalties** to hand out to
  anyone else, split however you like. Everyone you hit gets a popup saying you attacked them.
- If your horse loses, you **take penalties equal to your bet**.
- Under each player's name the lobby keeps a running tally of **chips won and penalties taken** (from lost bets
  and from attacks).

## How online play works

There is no game server. The person who makes the lobby is the **host**: their browser runs the rules
(`public/js/engine.js`) and sends the lobby state to everyone else. Players connect straight to the host's
browser (WebRTC) through the free public [PeerJS](https://peerjs.com) matchmaking service; the lobby code is
the host's PeerJS id (`jjhorserace-v1-<code>`). PeerJS's free TURN relay is the fallback for strict networks.

Races are deterministic: the host only sends a random seed, and every browser simulates exactly the same race
from it (`public/js/sim.js` sticks to `+ - * /` so all devices agree to the last bit).

**The lobby survives the host leaving.** If the host closes the tab, loses signal or their phone goes to sleep,
the other players notice within a few seconds, the longest-standing player claims the lobby code, and carries
on hosting with the last state everyone had: tallies, picks and a race in progress all survive. Everyone else
reconnects to them automatically. A host who just reloads the page grabs their lobby straight back. Players who
reload or drop out get their old seat (and tallies) back when they return.

## Play locally

```bash
npm start
```

Open http://localhost:8090. To try multiplayer on one computer, open a second tab, give it a different name
and join the code. (Tabs in one browser share the saved name, so rename yourself with the ✏️ button.)

## Tests

```bash
node tools/enginetest.mjs     # the rules: picks, rename rights, payouts, penalty limits, host takeover
node tools/simstats.mjs 3000  # race length, gate stops per race, lane fairness, determinism
```

## Deploying

`.github/workflows/pages.yml` runs the tests and publishes `public/` to GitHub Pages on every push to `main`.
It shows up at `josephjackman.com/horserace/` because this repo is named `horserace` and the account's user
site (`roamingjackmans-pixel.github.io`) has the `josephjackman.com` custom domain. The workflow also stamps
the version and adds `?v=<commit>` to every file URL so phones never mix old and new code.

## Project layout

```
public/              the game (this folder is what gets published)
  index.html, css/style.css, version.js
  js/main.js         screens, buttons, race playback, popups
  js/net.js          PeerJS lobby: host, join, reconnect, host handover
  js/engine.js       lobby state and rules (host only)
  js/sim.js          deterministic race simulation
  js/render.js       canvas track and cartoon horses
  js/audio.js        synthesized sound effects
  js/names.js        the 200 horse names
  vendor/peerjs.min.js
tools/               local server, tests, deploy stamp
```
