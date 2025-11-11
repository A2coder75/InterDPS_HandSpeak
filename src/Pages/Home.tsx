import React, { useEffect } from "react"
import "./Home.css"
import Computer from "../Images/Computer.jfif"
import Typewriter from "typewriter-effect/dist/core"
import Card1 from "../Components/Card1"
import Tilt from 'react-parallax-tilt'
import Image from '../Images/image.png'
import Image2 from '../Images/image2.png'

interface Props {
  mode: string
}

const Home: React.FC<Props> = ({ mode }) => {
  useEffect(() => {
    new Typewriter('#typewriter', {
      strings: ['any device', 'any viewport', 'any ratio'],
      autoStart: true,
      loop: true,
    })
  }, [])

  useEffect(() => {
    const elements = document.querySelectorAll('.appear')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )
    elements.forEach((el) => observer.observe(el))
    return () => elements.forEach((el) => observer.unobserve(el))
  }, [])

  const useCases = [
    { icon: "🏫", title: "Educational Institutions", description: "Schools and universities can use HandSpeakAI to bridge communication gaps between hearing and deaf students. It enables interactive learning, inclusive classrooms, and effortless communication between teachers and students without the need for interpreters or special hardware." },
    { icon: "🏥", title: "Healthcare Services", description: "Medical professionals can communicate easily with patients who rely on sign language. HandSpeakAI ensures clear understanding during consultations and emergencies, improving overall healthcare delivery, trust, and patient comfort between doctors and patients." },
    { icon: "🏢", title: "Corporate Meetings", description: "Businesses can conduct inclusive and barrier-free meetings where sign language users participate equally. HandSpeakAI promotes diversity, collaboration, and productivity by enabling effortless communication between team members, clients, and employers in any workplace setting." },
    { icon: "🎭", title: "Language Barriers", description: "HandSpeakAI enables smooth communication between people from different regions and languages. It works efficiently even on low internet connections, offering accurate translations without complex setup—ideal for travel, customer service, or cross-cultural collaboration." }
  ]

  return (
    <>
      <section id="section1" className={mode === "light" ? "lightSec1" : "darkSec1"}>
        <div className="hero-content">
          <h1 className="appear">HandSpeakAI</h1>
          <p className="appear">
            <b>HandSpeakAI</b> is an AI based on UN SDGs{" "}
            <b>Reducing Inequalities</b> and <br />
            <b>Improving quality of education</b>. It helps people with speech
            disabilities <br />
            converse using sign language — <b>A buffed Google Translate!</b>
          </p>
        </div>
      </section>

      <section id="section2" className={mode === "light" ? "lightSec2" : "darkSec2"}>
        <div id="content">
          <p className="appear">Works on <b id="typewriter"></b></p>

          <div className="devices-wrapper">
            <div className="device desktop appear">
              <div className="monitor">
                <div className="screen">
                  <img src={Image} alt="Desktop demo" />
                </div>
              </div>
            </div>
            <div className="device phone appear">
              <div className="body">
                <div className="notch"></div>
                <div className="screen"><img src={Image2} alt="Mobile demo" /></div>
                <div className="home-indicator"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="section3">
        <h1 className="appear">Unique Features</h1>
        <p className="topic appear">1) Customizable database</p>
        <p className="appear">Our application allows the user to add their own signs to our database and then 'train' our AI model to check for those signs, allowing them to easily communicate in their regional sign languages.</p>
        <p className="topic appear">2) Translated Output</p>
        <p className="appear">This application supports 30+ languages as different modes of outputs which can be instantly translated into, allowing the user to instantly communicate with anyone in the world.</p>
        <p className="topic appear">3) Transcripts</p>
        <p className="appear">While translating between signs and words, the user can select "Sentence mode" which allows the user to form grammatical sentences while 'signing'. They can also download a transcript - the entire conversation as a text document.</p>
        <p className="topic appear">4) Database sharing</p>
        <p className="appear">This application allows the user to save their edited database with all of their signs, transfer it between other people and then upload other people's database as well. They can choose to replace particular signs as well, making the application encourage collaboration among the users.</p>
        <p className="topic appear">5) Precise and Instant.</p>
        <p className="appear">This application returns a precise and instant output for the user, allowing them to communicate with others in ease.</p>
        
      </section>
      {/* <section id="section6">
        <h1>Unique Features</h1>
        <h4>1) Customizable Database</h4>
        <p>This application is designed to promote the regional languages </p>
      </section> */}

      <section id="section5">
        <h1 className="appear">Use Cases</h1>
        
        <div className="use-cases-container">
          {useCases.map((useCase, index) => (
            <Tilt key={index}>
              <div 
                className="use-case-card appear" 
                style={{ '--i': index } as React.CSSProperties}
              >
                <span className="use-case-icon appear"><p style={{textAlign: "center", fontSize:"39px"}}>{useCase.icon}</p></span>
                <h2 className="appear">{useCase.title}</h2>
                <p className="appear">{useCase.description}</p>
              </div>
            </Tilt>
          ))}
        </div>
      </section>
      <section id="section4" className={mode === "light" ? "lightSec2" : "darkSec2"}>
        <h1 className="prcs appear">How to Get Started:</h1>
        <div className="appear"><Card1 mode={mode} header="Translate" text="To start talking with your hands, just head over to the Translate page and turn on your camera!" count={1} /></div>
        <div className="appear"><Card1 mode={mode} header="Edit" text="If you want to create a custom database with your own signs, just head over to the Feed page." count={2} /></div>
      </section>
    </>
  )
}

export default Home
