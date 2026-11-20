/*
  Everything personal lives in this file. Edit the text, swap the
  photos in assets/, change the song, and the site updates itself.
*/
window.GIFT = {
  name: "Baby",                       // used in "Happy birthday, Baby!"
  pageTitle: "Snoopy wants to deliver a gift!",

  landing: {
    caption: "Snoopy wants to deliver a gift!",
    accept: "Accept",
    decline: "Decline",
  },

  decline: {
    title: "Are you sure?",
    back: "Back",
  },

  birthday: {
    title: "Happy birthday, {name}!",
    button: "Continue",
  },

  hub: {
    title: "Gifts for you!",
    subtitle: "click each one to open every gift",
  },

  // The five gifts, in tile order. "type" picks the page layout.
  gifts: [
    {
      type: "cake",
      tile: "assets/tile-cake.webp",
      title: "Blow the candles, baby",
      hint: "tap the cake, or blow into your mic",
      micButton: "use my mic",
      doneTitle: "Yay! Now make a wish",
      doneHint: "I hope every single one comes true",
    },
    {
      type: "flowers",
      tile: "assets/tile-flowers.webp",
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
      type: "song",
      tile: "assets/tile-music.webp",
      title: "This song reminds me of you",
      youtubeId: "icIWLaZeXR4",
      songLabel: "Linus and Lucy · Vince Guaraldi Trio",
      note:
        "Because the second it starts, everything feels a little lighter, the way it does when you walk into a room. It's playful and warm and impossible not to smile at, which is honestly just a description of you. Every time I hear it, I think: that's my person.",
    },
    {
      type: "photos",
      tile: "assets/tile-camera.webp",
      title: "My favorite person",
      photos: ["assets/photo-1.jpg", "assets/photo-2.jpg", "assets/photo-3.jpg"],
    },
    {
      type: "letter",
      tile: "assets/tile-letter.webp",
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
};
