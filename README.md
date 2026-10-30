# 🏇 Horse Race

A silly online horse racing party game for the browser. Make a lobby, share the 5-number code, bet chips on
ridiculous horses, and dish out penalties to your friends when you win.

**Play:** https://josephjackman.com/horserace/

## The rules

- One person **makes a lobby** and shares its **5-number code** (or the invite link, `?room=CODE`). Up to
  **8 players** can be in a lobby at once (seats of players who left don't count).
- A lobby starts with **4 to 6 horses**, each with one of **200 funny names**. The **same horses race every
  round**: names, looks, and everyone's pick and bet all carry over (change your pick any time before the
  start). The host can set **2 to 8 horses** (or roll a random 4–6): new horses join at the end, and taking
  horses away removes them from the end, so a horse added back later is brand new.
- Each player **picks a horse and bets 1 to 20 chips**. Several people can back the same horse, but only the
  **first person to pick it can name it and style it** (🎨 Customize, purely cosmetic): the horse's coat and
  its mane and tail (8 natural colours, 12 bright ones, 15 wild patterns like zebra, rainbow, galaxy and
  solid gold), the rider's outfit (same choices, or the lane's team colours), 15 hats for the rider
  (sombrero, wizard hat, mohawk, traffic cone...) and add-ons for both (jetpacks, unicorn horn, angel wings,
  capes, balloons...). The saddle-cloth number and blinkers keep the lane colour so horses stay easy to tell
  apart.
- The track has **20 evenly spaced gates** by default (the last gate is the finish line). The host can set it
  anywhere from **3 to 100 gates** between races, with presets for Quick (7), Classic (20), Long (50) and
  Marathon (100).
- Horses don't run smoothly. It's like rolling a die: on a steady beat one horse is picked completely at
  random and **hops forward exactly one gate** in a quick leap. Every horse has the same odds on every roll,
  so streaks happen (the same horse can hop 4 or 5 times in a row) and a horse way out in front can still be
  caught. With more horses the beat is quicker, so each horse hops about as often whatever the field size.
- Every time **all** the horses make it through the next gate for the first time, every horse stops for a
  moment: **one horse is boosted forward one gate and a different one is set back one gate**.
- No horse gets more boosts, or more setbacks, than **30% of the gates, rounded up**: 3 each on 7 gates, 6 on
  20, 30 on 100. (If every horse is already at its cap, the race doesn't stop at that gate.)
- **No runaways.** Each horse can hop forward at most **110% of the gates, rounded up** (22 hops on 20 gates).
  Boosts don't use up hops, but setbacks still cost ground: a horse set back 5 times on 20 gates can only
  reach gate 17 unless it's boosted. And until someone finishes, the leader is never more than **25% of the
  gates, rounded up** (5 on 20 gates) ahead of second place; the die simply won't pick a move that breaks
  either rule. If no horse is allowed to move at all, the one furthest ahead wins and bolts for the line
  (this essentially never happens).
- **Every race is written before it's run.** When the host starts a race, the game writes out the whole thing
  (every hop, stop, boost and setback, in order) and stores that script with the race; every screen then plays
  the same script. `node tools/simstats.mjs` checks every rule after every action of thousands of races.
- Horses that cross the finish line keep galloping, right off the screen. Then the results open on a
  **podium**: the winner reared up on it holding a trophy and cheering, everyone else standing sadly at the
  bottom. The host clicks **Next race** to go on to the next race.
- Rough race lengths: 7 gates about 8 seconds, 20 gates about 40 seconds, 50 gates about 2 minutes,
  100 gates about 4 minutes (plus a 4-second countdown).
- If your horse wins, you **win the chips you bet**, and you get **twice your bet in penalties** to hand out to
  anyone else, split however you like, but you have to hit at least one person (no mercy). Everyone you hit
  gets a popup saying you attacked them.
- If your horse loses, you **take penalties equal to your bet**.
- Under each player's name the lobby keeps a running tally of **chips won and penalties taken** (from lost bets
  and from attacks).

## How online play works

There is no game server. The person who makes the lobby is the **host**: their browser runs the rules
(`public/js/engine.js`) and sends the lobby state to everyone else. Players connect straight to the host's
browser (WebRTC) through the free public [PeerJS](https://peerjs.com) matchmaking service; the lobby code is
the host's PeerJS id (`jjhorserace-v1-<code>`).

**The backup relay.** Some phones and networks can't make that direct connection: mobile data behind carrier
NAT, VPNs, privacy or ad-blocking settings, some in-app browsers. (PeerJS's own free TURN relay, which used to
cover this, has shut down: `eu-0`/`us-0.turn.peerjs.com` no longer resolve.) So `public/js/relay.js` carries
the same messages through free public MQTT servers over ordinary secure websockets (EMQX, shiftr.io on port
443, HiveMQ), which work wherever a web page works:

- The host always listens on every relay server as well as for direct connections.
- A joining player tries direct first. If it fails, or hasn't opened within 6 seconds, they say hello through
  the relay instead (repeating it every 2 s until a host answers), and stick with whichever server and host
  answer first.
- A player who ended up on the relay only because the direct connection was slow tries direct again 8 and 45
  seconds later and switches over if it works.
- Relayed players show a 📡 RELAY tag in the lobby, and go to the back of the line for taking over hosting.
- A phone that can't even reach the PeerJS matchmaking service can still join through the relay (it just
  can't host).

Messages through the public relay servers aren't private (only game data goes through them: names, picks,
bets). Add `?forcerelay` to the page address to test the relay on one computer.

**Connection check.** `check.html` (linked under the Join button as "Can't get in? Run a connection check")
tests, on the player's own phone: the browser, whether direct connections work and what kind of network it is,
the matchmaking service, each relay server, and optionally a real lobby both ways (the host answers a `probe`
message without adding anyone). It ends with a plain-language verdict and a **Copy the results** button, so a
player who can't get in can send exactly what's blocked. In the browser console of the game, `hrTrace()` shows
how that tab's connection went.

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
node tools/enginetest.mjs     # the rules: picks, rename rights, payouts, penalty limits, 8-player cap
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
  check.html         the connection check page
  js/main.js         screens, buttons, race playback, popups
  js/net.js          PeerJS lobby: host, join, reconnect, host handover
  js/relay.js        the backup relay through public MQTT servers
  js/check.js        the connection check
  js/engine.js       lobby state and rules (host only)
  js/sim.js          deterministic race simulation
  js/render.js       canvas track and cartoon horses
  js/podium.js       the winner's podium scene after each race
  js/looks.js        every colour, pattern, hat and add-on a horse can be styled with
  js/costume.js      drawing those patterns, hats and add-ons
  dev/podium.html    preview page for the podium scene and horse poses
  dev/looks.html     gallery of every colour, pattern, hat and add-on
  js/audio.js        synthesized sound effects
  js/names.js        the 200 horse names
  vendor/peerjs.min.js
tools/               local server, tests, deploy stamp
```
