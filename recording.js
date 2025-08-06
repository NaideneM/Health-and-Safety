// GLOBAL VARIABLES for recording logic
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

/**
 * Checks if any record button is currently active (state "true" or "starting")
 */
function isAnyRecordingActive() {
  return document.querySelector(".record-toggle-btn[data-recording='true'], .record-toggle-btn[data-recording='starting']") !== null;
}

/**
 * Grey out (disable) all record buttons except the one that is active.
 */
function disableOtherRecordButtons(activeButton) {
  const buttons = document.querySelectorAll(".record-toggle-btn");
  buttons.forEach(btn => {
    if (btn !== activeButton) {
      btn.classList.add("inactive");
    }
  });
}

/**
 * Re-enable all record buttons (remove the greyed-out state).
 */
function enableAllRecordButtons() {
  const buttons = document.querySelectorAll(".record-toggle-btn");
  buttons.forEach(btn => {
    btn.classList.remove("inactive");
  });
}

/**
 * Toggle recording for the button associated with a given text area.
 * 
 * When not recording, the button enters a "starting" state:
 * - It shows "Starting..." and a loading spinner until the microphone is ready.
 * Once getUserMedia resolves, the button updates to display the stop icon.
 * 
 * When clicked while recording, it stops recording.
 */
async function toggleRecording(button) {
  // If button is greyed out (another recording is active), alert the user.
  if (button.classList.contains("inactive")) {
    alert("You're already recording. Please stop the active recording before starting another.");
    return;
  }
  
  // If the button is in the "starting" state, ignore additional clicks.
  if (button.dataset.recording === "starting") {
    return;
  }
  
  const targetId = button.getAttribute("data-target");
  const targetElement = document.getElementById(targetId);
  // The  icon is assumed to be the next sibling element.

  
  // If not currently recording, then start the recording process.
  if (!button.dataset.recording || button.dataset.recording === "false") {
    if (isAnyRecordingActive()) {
      alert("You're already recording. Please stop the active recording before starting another.");
      return;
    }
    
    // Set the button into a temporary "starting" state.
    button.dataset.recording = "starting";
    button.textContent = "Starting..."; // transitional state text
    button.classList.add("recording");
    disableOtherRecordButtons(button);
  
    
    try {
      console.log("Requesting microphone access for text area:", targetId);
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Once access is granted, update the state to active recording.
      button.dataset.recording = "true";
      button.innerHTML = '<i class="fa-solid fa-microphone-slash" style="color: #ff1900;"></i>'; 
   
      
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log("Recording stopped for text area:", targetId);
        // Stop all tracks so the microphone indicator turns off.
        audioStream.getTracks().forEach(track => track.stop());
        
        if (audioChunks.length === 0) {
          console.error("No audio recorded.");
          button.innerHTML = '<i class="fa-solid fa-microphone" style="color: #0fb800;"></i>'; 
          button.classList.remove("recording");
          button.dataset.recording = "false";
          enableAllRecordButtons();
          return;
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const transcript = await sendAudioToMoodle(audioBlob);
        
        if (transcript && targetElement) {
          // Append a space if content exists before appending the transcript.
          targetElement.value += (targetElement.value.trim() ? ' ' : '') + transcript;
        }
   
        button.innerHTML = '<i class="fa-solid fa-microphone" style="color: #0fb800;"></i>'; 
        button.classList.remove("recording");
        button.dataset.recording = "false";
        enableAllRecordButtons();
      };
      
      mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access was denied. Please enable it in your browser settings.");
      button.dataset.recording = "false";
      button.innerHTML = '<i class="fa-solid fa-microphone" style="color: #0fb800;"></i>'; 
      button.classList.remove("recording");
      enableAllRecordButtons();
    }
  } else {
    // If already recording, then stop the recording.
    if (mediaRecorder && mediaRecorder.state === "recording") {
      // Disable pointer events briefly to prevent multiple clicks.
      button.style.pointerEvents = "none";
      mediaRecorder.stop();
      setTimeout(() => { button.style.pointerEvents = "auto"; }, 100);
    }
  }
}

/**
 * Sends the recorded audio blob to the server (ajax.php) and returns the transcript.
 * Expects global variables window.cmid and window.sesskey to be set.
 */
async function sendAudioToMoodle(audioBlob) {
  const formData = new FormData();
  formData.append('audiofile', audioBlob);
  // Use the dynamic globals. (Ensure these are set via JS in your HTML before any recording happens.)
  formData.append('cmid', window.cmid || '');
  formData.append('sesskey', window.sesskey || '');
  
  try {
    const response = await fetch('ajax.php', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (result.error) {
      console.error(result.error);
      alert(result.error);
      return "";
    } else {
      console.log("Transcript:", result.transcript);
      return result.transcript;
    }
  } catch (err) {
    console.error(err);
    return "";
  }
}