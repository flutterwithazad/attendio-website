// Mobile menu toggle
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

hamburger.onclick = () => {
    mobileMenu.style.display =
        mobileMenu.style.display === "flex" ? "none" : "flex";
};

// Carousel Logic
const imgs = Array.from(document.querySelectorAll("#carousel img"));
const dots = Array.from(document.querySelectorAll(".dot"));
let index = 0;

function show(i) {
    imgs.forEach((img, idx) => img.classList.toggle("center", idx === i));
    dots.forEach((dot, idx) => dot.classList.toggle("active", idx === i));
    index = i;
}

dots.forEach((dot) =>
    dot.addEventListener("click", () => show(Number(dot.dataset.i)))
);

setInterval(() => show((index + 1) % imgs.length), 4000);

show(0);
