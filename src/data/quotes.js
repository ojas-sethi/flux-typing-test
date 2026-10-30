// Real quotes for "quotes" mode, all from public-domain works. Wording follows
// the original, with curly quotes and dashes replaced by keyboard characters.
const RAW_QUOTES = [
  // Novels
  { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen", source: "Pride and Prejudice", year: 1813 },
  { text: "One half of the world cannot understand the pleasures of the other.", author: "Jane Austen", source: "Emma", year: 1815 },
  { text: "The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.", author: "Jane Austen", source: "Northanger Abbey", year: 1817 },
  { text: "You pierce my soul. I am half agony, half hope.", author: "Jane Austen", source: "Persuasion", year: 1817 },
  { text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.", author: "Charles Dickens", source: "A Tale of Two Cities", year: 1859 },
  { text: "I will honour Christmas in my heart, and try to keep it all the year.", author: "Charles Dickens", source: "A Christmas Carol", year: 1843 },
  { text: "Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show.", author: "Charles Dickens", source: "David Copperfield", year: 1850 },
  { text: "My father's family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip.", author: "Charles Dickens", source: "Great Expectations", year: 1861 },
  { text: "Happy families are all alike; every unhappy family is unhappy in its own way.", author: "Leo Tolstoy", source: "Anna Karenina, tr. Constance Garnett", year: 1878 },
  { text: "There was no possibility of taking a walk that day.", author: "Charlotte Bronte", source: "Jane Eyre", year: 1847 },
  { text: "I am no bird; and no net ensnares me: I am a free human being with an independent will, which I now exert to leave you.", author: "Charlotte Bronte", source: "Jane Eyre", year: 1847 },
  { text: "Whatever our souls are made of, his and mine are the same.", author: "Emily Bronte", source: "Wuthering Heights", year: 1847 },
  { text: "Beware; for I am fearless, and therefore powerful.", author: "Mary Shelley", source: "Frankenstein", year: 1818 },
  { text: "Nothing is so painful to the human mind as a great and sudden change.", author: "Mary Shelley", source: "Frankenstein", year: 1818 },
  { text: "You don't know about me without you have read a book by the name of The Adventures of Tom Sawyer; but that ain't no matter.", author: "Mark Twain", source: "Adventures of Huckleberry Finn", year: 1884 },
  { text: "Few things are harder to put up with than the annoyance of a good example.", author: "Mark Twain", source: "Pudd'nhead Wilson", year: 1894 },
  { text: "Truth is stranger than fiction, but it is because Fiction is obliged to stick to possibilities; Truth isn't.", author: "Mark Twain", source: "Following the Equator", year: 1897 },
  { text: "The only way to get rid of a temptation is to yield to it.", author: "Oscar Wilde", source: "The Picture of Dorian Gray", year: 1890 },
  { text: "There is only one thing in the world worse than being talked about, and that is not being talked about.", author: "Oscar Wilde", source: "The Picture of Dorian Gray", year: 1890 },
  { text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'", author: "Lewis Carroll", source: "Alice's Adventures in Wonderland", year: 1865 },
  { text: "Why, sometimes I've believed as many as six impossible things before breakfast.", author: "Lewis Carroll", source: "Through the Looking-Glass", year: 1871 },
  { text: "What do we live for, if it is not to make life less difficult to each other?", author: "George Eliot", source: "Middlemarch", year: 1871 },
  { text: "I'm not afraid of storms, for I'm learning how to sail my ship.", author: "Louisa May Alcott", source: "Little Women", year: 1868 },
  { text: "How often have I said to you that when you have eliminated the impossible, whatever remains, however improbable, must be the truth?", author: "Arthur Conan Doyle", source: "The Sign of the Four", year: 1890 },
  { text: "You see, but you do not observe.", author: "Arthur Conan Doyle", source: "A Scandal in Bohemia", year: 1891 },
  { text: "It is a capital mistake to theorize before one has data.", author: "Arthur Conan Doyle", source: "A Scandal in Bohemia", year: 1891 },
  { text: "No one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man's and yet as mortal as his own.", author: "H. G. Wells", source: "The War of the Worlds", year: 1898 },
  { text: "Listen to them, the children of the night. What music they make!", author: "Bram Stoker", source: "Dracula", year: 1897 },
  { text: "No matter how dreary and gray our homes are, we people of flesh and blood would rather live there than in any other country, be it ever so beautiful. There is no place like home.", author: "L. Frank Baum", source: "The Wonderful Wizard of Oz", year: 1900 },
  { text: "Believe me, my young friend, there is nothing, absolutely nothing, half so much worth doing as simply messing about in boats.", author: "Kenneth Grahame", source: "The Wind in the Willows", year: 1908 },
  { text: "All children, except one, grow up. They soon know that they will grow up, and the way Wendy knew was this.", author: "J. M. Barrie", source: "Peter Pan", year: 1911 },
  { text: "To die will be an awfully big adventure.", author: "J. M. Barrie", source: "Peter Pan", year: 1911 },
  { text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.", author: "F. Scott Fitzgerald", source: "The Great Gatsby", year: 1925 },
  { text: "So we beat on, boats against the current, borne back ceaselessly into the past.", author: "F. Scott Fitzgerald", source: "The Great Gatsby", year: 1925 },
  { text: "Mrs. Dalloway said she would buy the flowers herself.", author: "Virginia Woolf", source: "Mrs Dalloway", year: 1925 },
  { text: "A woman must have money and a room of her own if she is to write fiction.", author: "Virginia Woolf", source: "A Room of One's Own", year: 1929 },

  // Plays
  { text: "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles And by opposing end them.", author: "William Shakespeare", source: "Hamlet", year: 1603 },
  { text: "This above all: to thine own self be true, And it must follow, as the night the day, Thou canst not then be false to any man.", author: "William Shakespeare", source: "Hamlet", year: 1603 },
  { text: "All the world's a stage, And all the men and women merely players; They have their exits and their entrances, And one man in his time plays many parts.", author: "William Shakespeare", source: "As You Like It", year: 1623 },
  { text: "Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him.", author: "William Shakespeare", source: "Julius Caesar", year: 1623 },
  { text: "Life's but a walking shadow, a poor player That struts and frets his hour upon the stage And then is heard no more. It is a tale Told by an idiot, full of sound and fury, Signifying nothing.", author: "William Shakespeare", source: "Macbeth", year: 1623 },
  { text: "What's in a name? That which we call a rose By any other name would smell as sweet.", author: "William Shakespeare", source: "Romeo and Juliet", year: 1597 },
  { text: "We are such stuff As dreams are made on, and our little life Is rounded with a sleep.", author: "William Shakespeare", source: "The Tempest", year: 1623 },
  { text: "Now is the winter of our discontent Made glorious summer by this sun of York.", author: "William Shakespeare", source: "Richard III", year: 1597 },
  { text: "We are all in the gutter, but some of us are looking at the stars.", author: "Oscar Wilde", source: "Lady Windermere's Fan", year: 1892 },
  { text: "The truth is rarely pure and never simple.", author: "Oscar Wilde", source: "The Importance of Being Earnest", year: 1895 },

  // Poetry
  { text: "Shall I compare thee to a summer's day? Thou art more lovely and more temperate: Rough winds do shake the darling buds of May, And summer's lease hath all too short a date.", author: "William Shakespeare", source: "Sonnet 18", year: 1609 },
  { text: "Once upon a midnight dreary, while I pondered, weak and weary, Over many a quaint and curious volume of forgotten lore, While I nodded, nearly napping, suddenly there came a tapping, As of some one gently rapping, rapping at my chamber door.", author: "Edgar Allan Poe", source: "The Raven", year: 1845 },
  { text: "All that we see or seem Is but a dream within a dream.", author: "Edgar Allan Poe", source: "A Dream Within a Dream", year: 1849 },
  { text: "I celebrate myself, and sing myself, And what I assume you shall assume, For every atom belonging to me as good belongs to you.", author: "Walt Whitman", source: "Song of Myself", year: 1855 },
  { text: "O Captain! my Captain! our fearful trip is done, The ship has weather'd every rack, the prize we sought is won.", author: "Walt Whitman", source: "O Captain! My Captain!", year: 1865 },
  { text: "Two roads diverged in a wood, and I, I took the one less traveled by, And that has made all the difference.", author: "Robert Frost", source: "The Road Not Taken", year: 1916 },
  { text: "The woods are lovely, dark and deep, But I have promises to keep, And miles to go before I sleep, And miles to go before I sleep.", author: "Robert Frost", source: "Stopping by Woods on a Snowy Evening", year: 1923 },
  { text: "If you can keep your head when all about you Are losing theirs and blaming it on you, If you can trust yourself when all men doubt you, But make allowance for their doubting too.", author: "Rudyard Kipling", source: "If", year: 1910 },
  { text: "A thing of beauty is a joy for ever: Its loveliness increases; it will never Pass into nothingness.", author: "John Keats", source: "Endymion", year: 1818 },
  { text: "I wandered lonely as a cloud That floats on high o'er vales and hills, When all at once I saw a crowd, A host, of golden daffodils.", author: "William Wordsworth", source: "I Wandered Lonely as a Cloud", year: 1807 },
  { text: "To see a World in a Grain of Sand And a Heaven in a Wild Flower, Hold Infinity in the palm of your hand And Eternity in an hour.", author: "William Blake", source: "Auguries of Innocence", year: 1863 },
  { text: "Tyger Tyger, burning bright, In the forests of the night; What immortal hand or eye, Could frame thy fearful symmetry?", author: "William Blake", source: "The Tyger", year: 1794 },
  { text: "To strive, to seek, to find, and not to yield.", author: "Alfred Tennyson", source: "Ulysses", year: 1842 },
  { text: "'Tis better to have loved and lost Than never to have loved at all.", author: "Alfred Tennyson", source: "In Memoriam A.H.H.", year: 1850 },
  { text: "The mind is its own place, and in itself Can make a Heav'n of Hell, a Hell of Heav'n.", author: "John Milton", source: "Paradise Lost", year: 1667 },
  { text: "Lives of great men all remind us We can make our lives sublime, And, departing, leave behind us Footprints on the sands of time.", author: "Henry Wadsworth Longfellow", source: "A Psalm of Life", year: 1838 },
  { text: "How do I love thee? Let me count the ways. I love thee to the depth and breadth and height My soul can reach.", author: "Elizabeth Barrett Browning", source: "Sonnets from the Portuguese 43", year: 1850 },
  { text: "Ah, but a man's reach should exceed his grasp, Or what's a heaven for?", author: "Robert Browning", source: "Andrea del Sarto", year: 1855 },
  { text: "She walks in beauty, like the night Of cloudless climes and starry skies; And all that's best of dark and bright Meet in her aspect and her eyes.", author: "Lord Byron", source: "She Walks in Beauty", year: 1815 },
  { text: "Water, water, every where, And all the boards did shrink; Water, water, every where, Nor any drop to drink.", author: "Samuel Taylor Coleridge", source: "The Rime of the Ancient Mariner", year: 1798 },
  { text: "'My name is Ozymandias, King of Kings; Look on my Works, ye Mighty, and despair!' Nothing beside remains.", author: "Percy Bysshe Shelley", source: "Ozymandias", year: 1818 },
  { text: "It matters not how strait the gate, How charged with punishments the scroll, I am the master of my fate, I am the captain of my soul.", author: "William Ernest Henley", source: "Invictus", year: 1888 },
  { text: "'Twas brillig, and the slithy toves Did gyre and gimble in the wabe: All mimsy were the borogoves, And the mome raths outgrabe.", author: "Lewis Carroll", source: "Jabberwocky", year: 1871 },
  { text: "The Owl and the Pussy-cat went to sea In a beautiful pea-green boat, They took some honey, and plenty of money, Wrapped up in a five-pound note.", author: "Edward Lear", source: "The Owl and the Pussy-cat", year: 1871 },
  { text: "To err is human, to forgive divine.", author: "Alexander Pope", source: "An Essay on Criticism", year: 1711 },
  { text: "A little learning is a dangerous thing; Drink deep, or taste not the Pierian spring.", author: "Alexander Pope", source: "An Essay on Criticism", year: 1711 },

  // Essays, letters and speeches
  { text: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.", author: "Henry David Thoreau", source: "Walden", year: 1854 },
  { text: "The mass of men lead lives of quiet desperation.", author: "Henry David Thoreau", source: "Walden", year: 1854 },
  { text: "Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Simplicity, simplicity, simplicity!", author: "Henry David Thoreau", source: "Walden", year: 1854 },
  { text: "A foolish consistency is the hobgoblin of little minds, adored by little statesmen and philosophers and divines.", author: "Ralph Waldo Emerson", source: "Self-Reliance", year: 1841 },
  { text: "Trust thyself: every heart vibrates to that iron string.", author: "Ralph Waldo Emerson", source: "Self-Reliance", year: 1841 },
  { text: "No man is an island, entire of itself; every man is a piece of the continent, a part of the main.", author: "John Donne", source: "Devotions upon Emergent Occasions", year: 1624 },
  { text: "Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.", author: "Francis Bacon", source: "Of Studies", year: 1625 },
  { text: "Reading maketh a full man; conference a ready man; and writing an exact man.", author: "Francis Bacon", source: "Of Studies", year: 1625 },
  { text: "When a man is tired of London, he is tired of life; for there is in London all that life can afford.", author: "Samuel Johnson", source: "Boswell's Life of Johnson", year: 1791 },
  { text: "For my part, I travel not to go anywhere, but to go. I travel for travel's sake. The great affair is to move.", author: "Robert Louis Stevenson", source: "Travels with a Donkey in the Cevennes", year: 1879 },
  { text: "The universe is change; our life is what our thoughts make it.", author: "Marcus Aurelius", source: "Meditations, tr. George Long", year: 1862 },
  { text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", author: "Sun Tzu", source: "The Art of War, tr. Lionel Giles", year: 1910 },
  { text: "I do not wish them to have power over men; but over themselves.", author: "Mary Wollstonecraft", source: "A Vindication of the Rights of Woman", year: 1792 },
  { text: "The Analytical Engine weaves algebraical patterns just as the Jacquard-loom weaves flowers and leaves.", author: "Ada Lovelace", source: "Notes on the Analytical Engine", year: 1843 },
  { text: "On two occasions I have been asked, 'Pray, Mr. Babbage, if you put into the machine wrong figures, will the right answers come out?' I am not able rightly to apprehend the kind of confusion of ideas that could provoke such a question.", author: "Charles Babbage", source: "Passages from the Life of a Philosopher", year: 1864 },
  { text: "If I have seen further it is by standing on the shoulders of Giants.", author: "Isaac Newton", source: "Letter to Robert Hooke", year: 1675 },
  { text: "There is grandeur in this view of life, with its several powers, having been originally breathed into a few forms or into one; and that, whilst this planet has gone cycling on according to the fixed law of gravity, from so simple a beginning endless forms most beautiful and most wonderful have been, and are being, evolved.", author: "Charles Darwin", source: "On the Origin of Species", year: 1859 },
  { text: "Early to bed and early to rise, makes a man healthy, wealthy, and wise.", author: "Benjamin Franklin", source: "Poor Richard's Almanack", year: 1735 },
  { text: "In this world nothing can be said to be certain, except death and taxes.", author: "Benjamin Franklin", source: "Letter to Jean-Baptiste Le Roy", year: 1789 },
  { text: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.", author: "Thomas Jefferson", source: "The Declaration of Independence", year: 1776 },
  { text: "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.", author: "Abraham Lincoln", source: "Gettysburg Address", year: 1863 },
  { text: "A house divided against itself cannot stand.", author: "Abraham Lincoln", source: "House Divided Speech", year: 1858 },
  { text: "With malice toward none, with charity for all, with firmness in the right as God gives us to see the right, let us strive on to finish the work we are in.", author: "Abraham Lincoln", source: "Second Inaugural Address", year: 1865 },
  { text: "If there is no struggle there is no progress.", author: "Frederick Douglass", source: "West India Emancipation Speech", year: 1857 },
  { text: "Power concedes nothing without a demand. It never did and it never will.", author: "Frederick Douglass", source: "West India Emancipation Speech", year: 1857 },
  { text: "These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country.", author: "Thomas Paine", source: "The American Crisis", year: 1776 },
  { text: "It is not the critic who counts; not the man who points out how the strong man stumbles, or where the doer of deeds could have done them better. The credit belongs to the man who is actually in the arena, whose face is marred by dust and sweat and blood.", author: "Theodore Roosevelt", source: "Citizenship in a Republic", year: 1910 },
];

const wordCount = (text) => text.split(" ").length;

// short: up to 15 words · medium: 16–30 · long: over 30
export const QUOTE_LENGTHS = ["any", "short", "medium", "long"];

function lengthOf(words) {
  if (words <= 15) return "short";
  if (words <= 30) return "medium";
  return "long";
}

export const QUOTES = RAW_QUOTES.map((q, i) => {
  const words = wordCount(q.text);
  return { ...q, id: i + 1, words, length: lengthOf(words) };
});

// A random quote of the given length, avoiding the most recently used ones
export function pickQuote(length = "any", recentIds = []) {
  const pool = QUOTES.filter((q) => length === "any" || q.length === length);
  const fresh = pool.filter((q) => !recentIds.includes(q.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}
