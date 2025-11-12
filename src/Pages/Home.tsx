import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Cpu, Brain, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="home">
      <motion.section
        className="hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h1>
          Welcome to <span>AI Mentor</span>
        </h1>
        <p>
          Experience the fusion of AI intuition and human creativity — your
          personalized Class 10 assistant for learning, thinking, and creating.
        </p>
        <div className="hero-buttons">
          <Link to="/feed" className="btn">AI Feed</Link>
          <Link to="/convert" className="btn btn-alt">AI Convert</Link>
        </div>
      </motion.section>

      <motion.section
        className="features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="feature-card">
          <Cpu size={32} />
          <h3>AI Feed</h3>
          <p>Explore curated AI insights, interactive Q&A, and real-time data.</p>
          <Link to="/feed">Explore</Link>
        </div>

        <div className="feature-card">
          <Brain size={32} />
          <h3>AI Convert</h3>
          <p>Transform ideas, text, and formats seamlessly with neural precision.</p>
          <Link to="/convert">Start</Link>
        </div>

        <div className="feature-card">
          <Sparkles size={32} />
          <h3>More Coming Soon</h3>
          <p>Stay tuned for creative AI tools and immersive experiences.</p>
        </div>
      </motion.section>
    </div>
  );
}
