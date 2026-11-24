/*
  Starting wording for a new gift. "{name}" turns into the friend's name.
  Gift order is fixed: cake, flowers, song, photos, letter.
*/
window.TEMPLATES = {
  bestie: {
    label: "Bestie",
    build: () => ({
      name: "",
      pageTitle: "Snoopy wants to deliver a gift!",
      landing: { caption: "Snoopy wants to deliver a gift!", accept: "Accept", decline: "Decline" },
      decline: { title: "Are you sure?", back: "Back" },
      birthday: { title: "Happy birthday, {name}!", button: "Continue" },
      hub: { title: "Gifts for you!", subtitle: "click each one to open every gift" },
      gifts: [
        {
          type: "cake", tile: "assets/tile-cake.webp",
          title: "Blow the candles, {name}",
          hint: "tap the cake, or blow into your mic",
          micButton: "use my mic",
          doneTitle: "Yay! Now make a wish",
          doneHint: "and yes, I'm in all of them",
        },
        {
          type: "flowers", tile: "assets/tile-flowers.webp",
          title: "Flowers for my bestie",
          subtitle: "with little things I love about you",
          notes: [
            "Your voice notes that are basically podcasts.",
            "How you hype me up like it's your job.",
            "The way you laugh at your own jokes.",
            "Our 3am talks about absolutely everything.",
            "How you always know when something's off.",
            "Your questionable (iconic) music taste.",
            "Every inside joke nobody else gets.",
            "How you show up, every single time.",
            "That one look across the room.",
            "How easy it is to just be me around you.",
          ],
        },
        {
          type: "song", tile: "assets/tile-music.webp",
          title: "This song reminds me of you",
          youtubeId: "icIWLaZeXR4",
          songLabel: "Linus and Lucy · Vince Guaraldi Trio",
          note: "Because it's loud, a little chaotic and impossible not to smile at, which is honestly just a description of you. Every time it comes on I think of every dumb, perfect thing we've done together.",
        },
        {
          type: "photos", tile: "assets/tile-camera.webp",
          title: "Us, being iconic",
          photos: ["assets/photo-1.jpg", "assets/photo-2.jpg", "assets/photo-3.jpg"],
        },
        {
          type: "letter", tile: "assets/tile-letter.webp",
          title: "Happy birthday, bestie!",
          paragraphs: [
            "Another year of you, and somehow I'm the one who feels lucky about it.",
            "Thank you for every late-night call, every \"get ready, I'm outside\", every time you laughed so hard you couldn't breathe and took me down with you. You make the boring days fun and the hard days lighter.",
            "I'm so proud of you, of who you are and everything you're becoming. Whatever this year brings, you've got me in your corner, loudest one in the room.",
            "Here's to more trips, more chaos and more memories we'll never be able to explain to anyone else.",
          ],
          signoff: "Love you forever,\nyour favourite person.",
        },
      ],
      back: "Back",
    }),
  },

  partner: {
    label: "Partner",
    build: () => ({
      name: "",
      pageTitle: "Snoopy wants to deliver a gift!",
      landing: { caption: "Snoopy wants to deliver a gift!", accept: "Accept", decline: "Decline" },
      decline: { title: "Are you sure?", back: "Back" },
      birthday: { title: "Happy birthday, {name}!", button: "Continue" },
      hub: { title: "Gifts for you!", subtitle: "click each one to open every gift" },
      gifts: [
        {
          type: "cake", tile: "assets/tile-cake.webp",
          title: "Blow the candles, baby",
          hint: "tap the cake, or blow into your mic",
          micButton: "use my mic",
          doneTitle: "Yay! Now make a wish",
          doneHint: "I hope every single one comes true",
        },
        {
          type: "flowers", tile: "assets/tile-flowers.webp",
          title: "Flowers for my baby",
          subtitle: "with little things I love about you",
          notes: [
            "The way you laugh at your own jokes.",
            "Your sleepy 2am voice notes.",
            "How you remember my coffee order.",
            "Your very serious dance moves.",
            "The way you say my name.",
            "How safe your hugs feel.",
            "Your random good-morning texts.",
            "How you cheer for my tiny wins.",
            "Your patience with me.",
            "Every inside joke we share.",
          ],
        },
        {
          type: "song", tile: "assets/tile-music.webp",
          title: "This song reminds me of you",
          youtubeId: "icIWLaZeXR4",
          songLabel: "Linus and Lucy · Vince Guaraldi Trio",
          note: "Because the second it starts, everything feels a little lighter, the way it does when you walk into a room. It's playful and warm and impossible not to smile at, which is honestly just a description of you. Every time I hear it, I think: that's my person.",
        },
        {
          type: "photos", tile: "assets/tile-camera.webp",
          title: "My favorite person",
          photos: ["assets/photo-1.jpg", "assets/photo-2.jpg", "assets/photo-3.jpg"],
        },
        {
          type: "letter", tile: "assets/tile-letter.webp",
          title: "Happy birthday, my baby!",
          paragraphs: [
            "It's your day, but somehow I'm the one who feels like I got the present, because I get to spend another year next to you.",
            "I don't say it enough, so here it is in writing: you make ordinary days feel like something worth remembering. The long calls, the dumb jokes, the quiet evenings where we do nothing at all. All of it is my favourite.",
            "I'm so proud of who you are and of everything you're becoming. Whatever this year throws at you, I'll be right here cheering louder than anyone.",
            "Thank you for being patient with me, for making me laugh when I need it most, and for choosing me every day. Here's to more birthdays, more memories, and more of us.",
          ],
          signoff: "Happy birthday, my love.\nYours, always.",
        },
      ],
      back: "Back",
    }),
  },
};
