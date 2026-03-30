import { FiGithub, FiLinkedin, FiMail, FiMapPin, FiPhone, FiUser } from "react-icons/fi";

const FOOTER_PROFILE = {
  name: "Anish Upreti",
  role: "Full Stack Developer (React + Python/Django, AI/ML/DL)",
  email: "anish.upr.47@gmail.com",
  phone: "9851352841",
  location: "Nepal",
  github: "github.com/anishupr47-git",
  linkedin: "www.linkedin.com/in/anishupreti47"
};

function Footer() {
  return (
    <footer className="footer-wrap">
      <div className="footer-divider" />

      <div className="footer-inner">
        <section className="footer-col">
          <h4>Profile</h4>
          <p>
            <FiUser /> {FOOTER_PROFILE.name}
          </p>
          <p>{FOOTER_PROFILE.role}</p>
        </section>

        <section className="footer-col with-divider">
          <h4>Contact</h4>
          <p>
            <FiMail />
            <a href={`mailto:${FOOTER_PROFILE.email}`}>{FOOTER_PROFILE.email}</a>
          </p>
          <p>
            <FiPhone />
            <a href={`tel:${FOOTER_PROFILE.phone}`}>{FOOTER_PROFILE.phone}</a>
          </p>
          <p>
            <FiMapPin /> {FOOTER_PROFILE.location}
          </p>
        </section>

        <section className="footer-col with-divider">
          <h4>Links</h4>
          <p>
            <FiGithub />
            <a href={`https://${FOOTER_PROFILE.github}`} target="_blank" rel="noreferrer">
              {FOOTER_PROFILE.github}
            </a>
          </p>
          <p>
            <FiLinkedin />
            <a href={`https://${FOOTER_PROFILE.linkedin}`} target="_blank" rel="noreferrer">
              {FOOTER_PROFILE.linkedin}
            </a>
          </p>
        </section>
      </div>
    </footer>
  );
}

export default Footer;
